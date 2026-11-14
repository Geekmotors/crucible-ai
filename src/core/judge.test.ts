import { describe, expect, it } from '@jest/globals';
import { CrucibleError } from './errors.js';
import { RunScope } from './state.js';
import { BlockingAdapter } from './test/blocking-adapter.fake.js';
import { Capture } from './test/capture.util.js';
import { ExpiredDeadline } from './test/expired-deadline.fake.js';
import { JudgeHarness } from './test/judge-harness.util.js';
import { JudgedResponse } from './test/judged-response.enum.js';
import { RunCount } from './test/run-count.enum.js';
import { ScriptedAdapter } from './test/scripted-adapter.fake.js';
import { StartGate } from './test/start-gate.util.js';
import { ClaimText } from './test/claim-text.enum.js';
import { CustomTimeout } from './test/custom-timeout.enum.js';
import { TraceHarness } from './test/trace-harness.util.js';
import { TraceText } from './test/trace-text.enum.js';
import { VerbosityLevel } from './test/verbosity-level.enum.js';
import { FactsHarness } from './test/facts-harness.util.js';
import { OptionsHarness } from './test/options-harness.util.js';
import { StateFact } from './test/state-fact.enum.js';
import type { CoherentOptions } from './assertion-options.js';

describe('Judge', () => {
  it('resolves true when the judge reply says the response is coherent', async () => {
    await expect(
      JudgeHarness.judgeReply('{"verdict":true,"reasoning":"consistent"}'),
    ).resolves.toBe(true);
  });

  it('resolves false when the judge reply says the response contradicts the claim', async () => {
    await expect(
      JudgeHarness.judgeReply('{"verdict":false,"reasoning":"contradiction"}'),
    ).resolves.toBe(false);
  });

  it('parses a reply padded with whitespace and newlines', async () => {
    await expect(
      JudgeHarness.judgeReply('\n\n   {"verdict":true,"reasoning":"consistent"}  \n'),
    ).resolves.toBe(true);
  });

  it('a non-JSON reply is a retryable infra error, never a verdict', async () => {
    const error = await JudgeHarness.replyFailure('the response is coherent');
    expect(error).toBeInstanceOf(CrucibleError);
    expect((error as CrucibleError).kind).toBe('infra');
    expect((error as CrucibleError).retryable).toBe(true);
  });

  it('a JSON reply without a boolean verdict and string reasoning is a retryable infra error', async () => {
    const error = await JudgeHarness.replyFailure('{"verdict":"yes","reasoning":42}');
    expect(error).toBeInstanceOf(CrucibleError);
    expect((error as CrucibleError).kind).toBe('infra');
    expect((error as CrucibleError).retryable).toBe(true);
  });

  it('re-asks once after an unparseable reply and accepts a valid second reply', async () => {
    await expect(
      JudgeHarness.judgeReplies(['not json at all', '{"verdict":true,"reasoning":"second try"}']),
    ).resolves.toBe(true);
  });

  it('an unparseable reply after the re-ask leaves an ErrorRecord readable within the run', async () => {
    const scope = new RunScope();
    const judge = JudgeHarness.judge(
      new ScriptedAdapter([{ resolve: 'still not json' }, { resolve: 'nope' }], 'retryable'),
      scope,
    );
    const outcome = await scope.enterRun(async () => {
      const error = await Capture.rejection(judge.judgeCoherent('the response', 'the claim'));
      return { error, errors: scope.context().errors };
    });
    expect(outcome.error).toBeInstanceOf(CrucibleError);
    expect((outcome.error as CrucibleError).kind).toBe('infra');
    expect((outcome.error as CrucibleError).retryable).toBe(true);
    expect(outcome.errors).toHaveLength(1);
  });

  it('parses a verdict wrapped in markdown code fences', async () => {
    await expect(
      JudgeHarness.judgeReply('```json\n{"verdict":true,"reasoning":"fenced"}\n```'),
    ).resolves.toBe(true);
  });

  it.each([
    ['undefined response', undefined, 'claim'],
    ['object claim', 'response', { not: 'a string' }],
  ])('rejects a non-string argument (%s) as a usage error', async (_label, response, claim) => {
    const scope = new RunScope();
    const judge = JudgeHarness.judge(new ScriptedAdapter([], 'retryable'), scope);
    const error = await scope.enterRun(() =>
      Capture.rejection(judge.judgeCoherent(response as string, claim as string)),
    );
    expect(error).toBeInstanceOf(CrucibleError);
    expect((error as CrucibleError).kind).toBe('usage');
  });

  it('judging outside a run scope is a usage error', async () => {
    const judge = JudgeHarness.judge(new ScriptedAdapter([], 'retryable'), new RunScope());
    const error = await Capture.rejection(judge.judgeCoherent('the response', 'the claim'));
    expect(error).toBeInstanceOf(CrucibleError);
    expect((error as CrucibleError).kind).toBe('usage');
  });

  it('an infra failure propagates and leaves an ErrorRecord readable within the run', async () => {
    const scope = new RunScope();
    const cause = new Error('provider down');
    const judge = JudgeHarness.judge(new ScriptedAdapter([{ reject: cause }], 'fatal'), scope);
    const outcome = await scope.enterRun(async () => {
      const error = await Capture.rejection(judge.judgeCoherent('the response', 'the claim'));
      return { error, errors: scope.context().errors };
    });
    expect(outcome.error).toBeInstanceOf(CrucibleError);
    expect((outcome.error as CrucibleError).kind).toBe('infra');
    expect(outcome.errors).toHaveLength(1);
    expect(outcome.errors[0]?.attempts).toBe(1);
  });

  it('a successful judgment appends a VerdictRecord readable within the run', async () => {
    const scope = new RunScope();
    const judge = JudgeHarness.judge(
      new ScriptedAdapter(
        [{ resolve: '{"verdict":false,"reasoning":"names the mismatch"}' }],
        'retryable',
      ),
      scope,
    );
    const verdicts = await scope.enterRun(async () => {
      await judge.judgeCoherent('the response', 'the claim');
      return scope.context().verdicts;
    });
    expect(verdicts).toEqual([
      {
        assertion: 'coherent',
        claim: 'the claim',
        verdict: false,
        reasoning: 'names the mismatch',
        response: 'the response',
        facts: [],
        seq: 0,
      },
    ]);
  });

  it('an in-flight judge call rejects as soon as the run’s test aborts', async () => {
    const scope = new RunScope();
    const controller = new AbortController();
    const judge = JudgeHarness.judge(new BlockingAdapter(new StartGate(RunCount.Single)), scope);
    const pending = scope.enterRun(
      () => Capture.rejection(judge.judgeCoherent('the response', 'the claim')),
      controller.signal,
    );
    controller.abort();
    await expect(pending).resolves.toBeDefined();
  });

  it('a judge call that outlives its deadline errors as retryable infra — never a plain failure', async () => {
    const scope = new RunScope();
    const judge = JudgeHarness.judge(
      new BlockingAdapter(new StartGate(RunCount.Single)),
      scope,
      new ExpiredDeadline().signal,
    );
    const error = await scope.enterRun(() =>
      Capture.rejection(judge.judgeCoherent('the response', 'the claim')),
    );
    expect(error).toBeInstanceOf(CrucibleError);
    expect((error as CrucibleError).kind).toBe('infra');
    expect((error as CrucibleError).retryable).toBe(true);
  });
});

describe('Judge — facts', () => {
  it('sends a single per-call fact when the run has none', async () => {
    const scope = new RunScope();
    const judge = JudgeHarness.factJudge(scope, [StateFact.Letter]);
    const verdict = await scope.enterRun(() =>
      judge.judgeCoherent(JudgedResponse.Default, ClaimText.Default, { facts: StateFact.Letter }),
    );
    expect(verdict).toBe(true);
  });

  it('a later call does not see an earlier call’s facts', async () => {
    const scope = new RunScope();
    const judge = JudgeHarness.factJudge(scope, [StateFact.Casino]);
    const verdict = await scope.enterRun(async () => {
      scope.appendState(StateFact.Casino);
      await judge.judgeCoherent(JudgedResponse.Default, ClaimText.Default, {
        facts: StateFact.Home,
      });
      return judge.judgeCoherent(JudgedResponse.Default, ClaimText.Default);
    });
    expect(verdict).toBe(true);
  });

  it('per-call facts never enter the run’s facts', async () => {
    const scope = new RunScope();
    const judge = JudgeHarness.factJudge(scope, [StateFact.Casino]);
    const state = await scope.enterRun(async () => {
      scope.appendState(StateFact.Casino);
      await judge.judgeCoherent(JudgedResponse.Default, ClaimText.Default, {
        facts: StateFact.Home,
      });
      return scope.context().state;
    });
    expect(state).toEqual([StateFact.Casino]);
  });

  it('records the facts each call used, unaffected by facts added afterwards', async () => {
    const scope = new RunScope();
    const judge = JudgeHarness.factJudge(scope, [StateFact.Casino]);
    const verdicts = await scope.enterRun(async () => {
      scope.appendState(StateFact.Casino);
      await judge.judgeCoherent(JudgedResponse.Default, ClaimText.Default, {
        facts: StateFact.Home,
      });
      await judge.judgeCoherent(JudgedResponse.Default, ClaimText.Default);
      scope.appendState(StateFact.Letter);
      return scope.context().verdicts;
    });
    expect(verdicts.map((record) => record.facts)).toEqual([
      [StateFact.Casino, StateFact.Home],
      [StateFact.Casino],
    ]);
  });

  it('judges against the facts as given when the caller mutates its array mid-call', async () => {
    const scope = new RunScope();
    const judge = JudgeHarness.factJudge(scope, [StateFact.Home]);
    const verdict = await scope.enterRun(() => {
      const facts = [StateFact.Home];
      const pending = judge.judgeCoherent(JudgedResponse.Default, ClaimText.Default, { facts });
      facts.push(StateFact.Letter);
      return pending;
    });
    expect(verdict).toBe(true);
  });

  it('a concurrent call in the same run does not see another call’s facts', async () => {
    const scope = new RunScope();
    const judge = JudgeHarness.factJudge(scope, [StateFact.Casino]);
    const verdict = await scope.enterRun(async () => {
      scope.appendState(StateFact.Casino);
      const withOwnFacts = judge.judgeCoherent(JudgedResponse.Default, ClaimText.Default, {
        facts: StateFact.Home,
      });
      const withRunFacts = judge.judgeCoherent(JudgedResponse.Default, ClaimText.Default);
      await withOwnFacts;
      return withRunFacts;
    });
    expect(verdict).toBe(true);
  });

  it('options without facts judge against the run facts alone', async () => {
    const scope = new RunScope();
    const judge = JudgeHarness.factJudge(scope, [StateFact.Casino]);
    const verdict = await scope.enterRun(() => {
      scope.appendState(StateFact.Casino);
      return judge.judgeCoherent(JudgedResponse.Default, ClaimText.Default, {});
    });
    expect(verdict).toBe(true);
  });

  it.each(FactsHarness.invalid())(
    'rejects %s as per-call facts as a usage error',
    async (_label, facts) => {
      const scope = new RunScope();
      const judge = JudgeHarness.factJudge(scope, []);
      const error = await scope.enterRun(() =>
        Capture.rejection(
          judge.judgeCoherent(JudgedResponse.Default, ClaimText.Default, {
            facts,
          } as CoherentOptions),
        ),
      );
      expect(error).toBeInstanceOf(CrucibleError);
      expect((error as CrucibleError).kind).toBe('usage');
    },
  );

  it.each([
    ['a string', StateFact.Casino],
    ['an array', [StateFact.Casino]],
    ['null', null],
    ['an unknown key', { fact: StateFact.Casino }],
    ...OptionsHarness.nonPlain(),
  ])('rejects %s as coherent options as a usage error', async (_label, options) => {
    const scope = new RunScope();
    const judge = JudgeHarness.factJudge(scope, []);
    const error = await scope.enterRun(() =>
      Capture.rejection(
        judge.judgeCoherent(JudgedResponse.Default, ClaimText.Default, options as CoherentOptions),
      ),
    );
    expect(error).toBeInstanceOf(CrucibleError);
    expect((error as CrucibleError).kind).toBe('usage');
  });

  it('per-call facts outside a run scope are a usage error', async () => {
    const judge = JudgeHarness.factJudge(new RunScope(), [StateFact.Home]);
    const error = await Capture.rejection(
      judge.judgeCoherent(JudgedResponse.Default, ClaimText.Default, { facts: StateFact.Home }),
    );
    expect(error).toBeInstanceOf(CrucibleError);
    expect((error as CrucibleError).kind).toBe('usage');
  });
});

describe('Judge — inference timeout', () => {
  it('judges a reply slower than 30 s when the run allows a longer inference timeout', async () => {
    await expect(JudgeHarness.slowReply(CustomTimeout.Long)).resolves.toBe(true);
  });

  it('keeps the built-in 30 s inference timeout when the run sets none', async () => {
    const error = await Capture.rejection(JudgeHarness.slowReply());
    expect((error as CrucibleError).kind).toBe('infra');
    expect((error as CrucibleError).retryable).toBe(true);
  });

  it('aborts a judge call at a shorter inference timeout as retryable infra', async () => {
    const error = await JudgeHarness.blockedFailure(CustomTimeout.Short, CustomTimeout.Short);
    expect((error as CrucibleError).kind).toBe('infra');
    expect((error as CrucibleError).retryable).toBe(true);
  });
});

describe('Judge — debug trace', () => {
  it('traces an unusable reply before the re-ask, then the verdict with its claim', async () => {
    const output = await JudgeHarness.tracedOutput(
      [TraceText.UnparseableReply, TraceText.Reply],
      new TraceHarness(),
    );
    expect(output).toContain('judge reply 1 unusable');
    expect(output).toContain(`judge verdict true for coherent "${ClaimText.KeepsSecret}"`);
  });

  it('traces a judge call that errored', async () => {
    const output = await JudgeHarness.tracedOutput(['still not json', 'nope'], new TraceHarness());
    expect(output).toContain('judge reply 2 unusable');
    expect(output).toContain('judge call errored');
  });

  it('writes nothing below debug verbosity', async () => {
    await expect(
      JudgeHarness.tracedOutput(
        [TraceText.UnparseableReply, TraceText.Reply],
        new TraceHarness(VerbosityLevel.Full),
      ),
    ).resolves.toBe('');
  });
});
