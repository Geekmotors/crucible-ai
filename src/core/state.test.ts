import { describe, expect, it } from '@jest/globals';
import { CrucibleError } from './errors.js';
import { RunScope } from './state.js';
import { Capture } from './test/capture.util.js';
import { RunCount } from './test/run-count.enum.js';
import { StateFact } from './test/state-fact.enum.js';
import { StateHarness } from './test/state-harness.util.js';
import { StateIsolationHarness } from './test/state-isolation-harness.util.js';

describe('RunScope', () => {
  it('gives every run a fresh context — concurrent runs never see each other', async () => {
    const scope = new RunScope();
    const [first, second] = await Promise.all([
      scope.enterRun(async () => {
        scope.context().state.push('first-fact');
        scope.recordVerdict(StateHarness.verdict('first claim'));
        await Promise.resolve();
        return scope.context();
      }),
      scope.enterRun(async () => {
        await Promise.resolve();
        scope.recordVerdict(StateHarness.verdict('second claim'));
        return scope.context();
      }),
    ]);
    expect(first.verdicts.map((record) => record.claim)).toEqual(['first claim']);
    expect(second.verdicts.map((record) => record.claim)).toEqual(['second claim']);
    expect(first.state).toEqual(['first-fact']);
    expect(second.state).toEqual([]);
  });

  it('reading context outside a run scope is a usage error', () => {
    const error = Capture.thrown(() => new RunScope().context());
    expect(error).toBeInstanceOf(CrucibleError);
    expect((error as CrucibleError).kind).toBe('usage');
  });

  it('recording a verdict outside a run scope is a usage error', () => {
    const error = Capture.thrown(() => new RunScope().recordVerdict(StateHarness.verdict('claim')));
    expect(error).toBeInstanceOf(CrucibleError);
    expect((error as CrucibleError).kind).toBe('usage');
  });

  it('appended verdicts are readable within the same run, in sequence order', async () => {
    const scope = new RunScope();
    const verdicts = await scope.enterRun(async () => {
      scope.recordVerdict(StateHarness.verdict('first claim'));
      scope.recordVerdict(StateHarness.verdict('second claim'));
      return scope.context().verdicts;
    });
    expect(verdicts.map((record) => ({ claim: record.claim, seq: record.seq }))).toEqual([
      { claim: 'first claim', seq: 0 },
      { claim: 'second claim', seq: 1 },
    ]);
  });

  it('verdicts and errors share one sequence so run history keeps its order', async () => {
    const scope = new RunScope();
    const context = await scope.enterRun(async () => {
      scope.recordVerdict(StateHarness.verdict('claim'));
      scope.recordError({ cause: new Error('boom'), attempts: 1 });
      return scope.context();
    });
    expect(context.verdicts[0]?.seq).toBe(0);
    expect(context.errors[0]?.seq).toBe(1);
  });

  it('appends a single string verbatim to the run state', async () => {
    const scope = new RunScope();
    const state = await scope.enterRun(async () => {
      scope.appendState(StateFact.Casino);
      return scope.context().state;
    });
    expect(state).toEqual([StateFact.Casino]);
  });

  it('appends each element of an array, accumulating across calls in call order', async () => {
    const scope = new RunScope();
    const state = await scope.enterRun(async () => {
      scope.appendState([StateFact.Casino, StateFact.Home]);
      scope.appendState(StateFact.Letter);
      return scope.context().state;
    });
    expect(state).toEqual([StateFact.Casino, StateFact.Home, StateFact.Letter]);
  });

  it('an empty array leaves the run stateless', async () => {
    const scope = new RunScope();
    const state = await scope.enterRun(async () => {
      scope.appendState([]);
      return scope.context().state;
    });
    expect(state).toEqual([]);
  });

  it('an empty string is kept verbatim — state is never interpreted', async () => {
    const scope = new RunScope();
    const state = await scope.enterRun(async () => {
      scope.appendState(StateFact.Empty);
      return scope.context().state;
    });
    expect(state).toEqual([StateFact.Empty]);
  });

  it.each([
    ['a number', 42],
    ['undefined', undefined],
    ['null', null],
    ['an object', { fact: StateFact.Casino }],
    ['an array holding a non-string', [StateFact.Casino, 42]],
  ])('rejects %s as a usage error and leaves the state unchanged', async (_label, entries) => {
    const scope = new RunScope();
    const outcome = await scope.enterRun(async () => {
      scope.appendState(StateFact.Home);
      const error = Capture.thrown(() => scope.appendState(entries));
      return { error, state: scope.context().state };
    });
    expect(outcome.error).toBeInstanceOf(CrucibleError);
    expect((outcome.error as CrucibleError).kind).toBe('usage');
    expect(outcome.state).toEqual([StateFact.Home]);
  });

  it('appending state outside a run scope is a usage error', () => {
    const error = Capture.thrown(() => new RunScope().appendState(StateFact.Casino));
    expect(error).toBeInstanceOf(CrucibleError);
    expect((error as CrucibleError).kind).toBe('usage');
  });

  it('interleaved runs each see only the state they appended', async () => {
    const scope = new RunScope();
    const facts = StateIsolationHarness.facts(RunCount.Gated);
    const seen = await StateIsolationHarness.interleave(scope, facts, async () => [
      ...scope.context().state,
    ]);
    expect(seen).toEqual(facts.map((fact) => [fact]));
  });
});
