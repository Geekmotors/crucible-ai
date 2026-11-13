import { describe, expect, it } from '@jest/globals';
import { CrucibleError } from './errors.js';
import { RunScope } from './state.js';
import { Capture } from './test/capture.util.js';
import { FactAwareAdapter } from './test/fact-aware-adapter.fake.js';
import { JudgeHarness } from './test/judge-harness.util.js';
import { RunCount } from './test/run-count.enum.js';
import { ScriptedAdapter } from './test/scripted-adapter.fake.js';
import { StateFact } from './test/state-fact.enum.js';
import { StateIsolationHarness } from './test/state-isolation-harness.util.js';

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
        seq: 0,
      },
    ]);
  });

  it('judges against the state loaded in the run', async () => {
    const scope = new RunScope();
    const judge = JudgeHarness.judge(new FactAwareAdapter(StateFact.Casino), scope);
    const verdict = await scope.enterRun(() => {
      scope.appendState([StateFact.Casino, StateFact.Home]);
      return judge.judgeCoherent('the response', 'the claim');
    });
    expect(verdict).toBe(true);
  });

  it('judges a stateless run against the response alone', async () => {
    const scope = new RunScope();
    const judge = JudgeHarness.judge(new FactAwareAdapter(StateFact.Casino), scope);
    const verdict = await scope.enterRun(() => judge.judgeCoherent('the response', 'the claim'));
    expect(verdict).toBe(false);
  });

  it('state appended after an act reaches later judgments, never earlier ones', async () => {
    const scope = new RunScope();
    const judge = JudgeHarness.judge(new FactAwareAdapter(StateFact.Letter), scope);
    const outcome = await scope.enterRun(async () => {
      scope.appendState(StateFact.Casino);
      const before = await judge.judgeCoherent('the response', 'the claim');
      scope.appendState(StateFact.Letter);
      const after = await judge.judgeCoherent('the response', 'the claim');
      return { before, after, verdicts: scope.context().verdicts.map((record) => record.verdict) };
    });
    expect(outcome).toEqual({ before: false, after: true, verdicts: [false, true] });
  });

  it('interleaved runs are each judged against only their own state', async () => {
    const scope = new RunScope();
    const facts = StateIsolationHarness.facts(RunCount.Gated);
    const recognised = facts[0] as string;
    const judge = JudgeHarness.judge(new FactAwareAdapter(recognised), scope);
    const verdicts = await StateIsolationHarness.interleave(scope, facts, () =>
      judge.judgeCoherent('the response', 'the claim'),
    );
    expect(verdicts).toEqual(facts.map((fact) => fact === recognised));
  });
});
