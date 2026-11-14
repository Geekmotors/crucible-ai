import { describe, expect, it } from '@jest/globals';
import type { RunAssertions } from './run-assertions.js';
import { Capture } from './test/capture.util.js';
import { ClaimText } from './test/claim-text.enum.js';
import { JudgedResponse } from './test/judged-response.enum.js';
import { DetachedCallbacks } from './test/detached-callbacks.fake.js';
import { GateHarness } from './test/gate-harness.util.js';
import { RowValue } from './test/row-value.enum.js';
import { RunContextCall } from './test/run-context-call.enum.js';
import { RunCount } from './test/run-count.enum.js';
import { StartGate } from './test/start-gate.util.js';
import { StateFact } from './test/state-fact.enum.js';
import { Threshold } from './test/threshold.enum.js';
import { TimeBudget } from './time-budget.util.js';
import { CrucibleVerdictError } from './verdict-error.js';

describe('Gate', () => {
  it('runs the body once per declared run when the returned test is invoked', async () => {
    let executed = 0;
    const test = new GateHarness().wrap({ runs: RunCount.Smaller }, () => {
      executed += 1;
    });
    await test();
    expect(executed).toBe(RunCount.Smaller);
  });

  it('runs the body 10 times when nothing declares runs', async () => {
    let executed = 0;
    await new GateHarness().wrap(() => {
      executed += 1;
    })();
    expect(executed).toBe(RunCount.BuiltIn);
  });

  it('never runs the body before the returned test is invoked', () => {
    let ran = false;
    new GateHarness().wrap(() => {
      ran = true;
    });
    expect(ran).toBe(false);
  });

  it('passes when enough runs pass the threshold', async () => {
    let run = 0;
    const test = new GateHarness().wrap(
      { runs: RunCount.Smaller, threshold: Threshold.Half },
      () => {
        run += 1;
        if (run === 1) {
          throw new Error('one run misses');
        }
      },
    );
    await expect(test()).resolves.toBeUndefined();
  });

  it('throws a failed verdict when too few runs pass', async () => {
    const test = new GateHarness().wrap({ runs: RunCount.Smaller }, () => {
      throw new Error('every run misses');
    });
    const error = await Capture.rejection(test());
    expect(error).toBeInstanceOf(CrucibleVerdictError);
    expect((error as CrucibleVerdictError).outcome).toBe('failed');
  });

  it('throws an errored verdict when its own test deadline passes', async () => {
    const harness = new GateHarness();
    const pending = Capture.rejection(
      harness.wrap(GateHarness.smoke, () => new Promise<void>(() => {}))(),
    );
    harness.timer.advance(TimeBudget.testTimeoutFor(RunCount.Single));
    const error = await pending;
    expect(error).toBeInstanceOf(CrucibleVerdictError);
    expect((error as CrucibleVerdictError).outcome).toBe('errored');
  });

  it('passes the runner’s own arguments to the body after the run context', async () => {
    let received: unknown[] = [];
    const test = new GateHarness().wrap(
      GateHarness.smoke,
      (_t: RunAssertions, ...row: unknown[]) => {
        received = row;
      },
    );
    await test(RowValue.Apples, RowValue.Pears);
    expect(received).toEqual([RowValue.Apples, RowValue.Pears]);
  });

  it('takes settings from the crucible.describe group it was created in', async () => {
    let executed = 0;
    const test = new GateHarness().wrapInGroup({ runs: RunCount.Smaller }, () => {
      executed += 1;
    });
    await test();
    expect(executed).toBe(RunCount.Smaller);
  });

  it('its own options override the enclosing group', async () => {
    let executed = 0;
    const test = new GateHarness().wrapInGroup(
      { runs: RunCount.Smaller },
      { runs: RunCount.Single },
      () => {
        executed += 1;
      },
    );
    await test();
    expect(executed).toBe(RunCount.Single);
  });

  it('reads the project test defaults when the test runs', async () => {
    let executed = 0;
    await new GateHarness([], { runs: RunCount.Smaller }).wrap(() => {
      executed += 1;
    })();
    expect(executed).toBe(RunCount.Smaller);
  });

  it.each(GateHarness.invalidCalls())(
    'rejects %s with a usage error at creation',
    (_call, args) => {
      const error = Capture.thrown(() => new GateHarness().wrap(...args));
      expect(GateHarness.kind(error)).toBe('usage');
    },
  );
});

describe('the run context t', () => {
  it('t.facts reach the judge in t.coherent and t.extract', async () => {
    const test = new GateHarness().wrap(GateHarness.smoke, async (t: RunAssertions) => {
      t.facts(StateFact.Casino);
      await GateHarness.requireSeen(t);
      await GateHarness.extractsSeen(t);
    });
    await expect(test()).resolves.toBeUndefined();
  });

  it('facts added through t are seen by the global functions in the same run', async () => {
    const harness = new GateHarness([StateFact.Casino, StateFact.Home]);
    const test = harness.wrap(GateHarness.smoke, async (t: RunAssertions) => {
      t.facts(StateFact.Casino);
      harness.assertions.facts(StateFact.Home);
      await GateHarness.requireSeen(harness.assertions);
    });
    await expect(test()).resolves.toBeUndefined();
  });

  it('facts added through the global function are seen by t in the same run', async () => {
    const harness = new GateHarness([StateFact.Casino, StateFact.Home]);
    const test = harness.wrap(GateHarness.smoke, async (t: RunAssertions) => {
      harness.assertions.facts(StateFact.Casino);
      t.facts(StateFact.Home);
      await GateHarness.requireSeen(t);
    });
    await expect(test()).resolves.toBeUndefined();
  });

  it('gives each concurrent run its own t', async () => {
    const arrived = new StartGate(RunCount.Smaller);
    const test = new GateHarness().wrap(
      { runs: RunCount.Smaller, threshold: Threshold.Certain },
      async (t: RunAssertions) => {
        t.facts(StateFact.Casino);
        await arrived.arrive();
        await GateHarness.requireSeen(t);
      },
    );
    await expect(test()).resolves.toBeUndefined();
  });

  it('t keeps working from a callback that lost the async context', async () => {
    const detached = new DetachedCallbacks();
    const test = new GateHarness().wrap(GateHarness.smoke, async (t: RunAssertions) => {
      const verdict = await detached.schedule(() => {
        t.facts(StateFact.Casino);
        return t.coherent(JudgedResponse.Default, ClaimText.Default);
      });
      if (!verdict) {
        throw new Error('the detached call did not reach its run');
      }
    });
    const pending = test();
    await detached.scheduled;
    detached.flush();
    await expect(pending).resolves.toBeUndefined();
  });

  it('the global functions from a callback that lost the async context are a usage error', async () => {
    const harness = new GateHarness();
    const detached = new DetachedCallbacks();
    const pending = Capture.rejection(
      harness.wrap(GateHarness.smoke, async () => {
        await detached.schedule(() => harness.assertions.facts(StateFact.Casino));
      })(),
    );
    await detached.scheduled;
    detached.flush();
    expect(GateHarness.kind(await pending)).toBe('usage');
  });

  it.each([RunContextCall.Facts, RunContextCall.Coherent, RunContextCall.Extract])(
    't.%s after its run passed is a usage error',
    async (call) => {
      const t = await new GateHarness().contextAfterRun();
      expect(GateHarness.kind(await GateHarness.callError(t, call))).toBe('usage');
    },
  );

  it('t.facts after its run ended throws at the call', async () => {
    const t = await new GateHarness().contextAfterRun();
    expect(GateHarness.kind(Capture.thrown(() => t.facts(StateFact.Casino)))).toBe('usage');
  });

  it('t of a run that failed is a usage error after the run', async () => {
    const t = await new GateHarness().contextAfterFailedRun();
    expect(GateHarness.kind(await GateHarness.callError(t, RunContextCall.Facts))).toBe('usage');
  });

  it('t of a run discarded by the test deadline is a usage error', async () => {
    const t = await new GateHarness().contextOfDiscardedRun();
    expect(GateHarness.kind(await GateHarness.callError(t, RunContextCall.Facts))).toBe('usage');
  });

  it('t validates facts like crucible.facts', async () => {
    let error: unknown;
    await new GateHarness().wrap(GateHarness.smoke, (t: RunAssertions) => {
      error = Capture.thrown(() => t.facts(RunCount.Single as unknown as string));
    })();
    expect(GateHarness.kind(error)).toBe('usage');
  });
});
