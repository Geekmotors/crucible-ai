import { describe, expect, it } from '@jest/globals';
import type { RunAssertions } from './run-assertions.js';
import { CustomTimeout } from './test/custom-timeout.enum.js';
import { GateHarness } from './test/gate-harness.util.js';
import { NeutralName } from './test/neutral-name.enum.js';
import { NeutralProperty } from './test/neutral-property.enum.js';
import { NeutralRunnerFake } from './test/neutral-runner.fake.js';
import { RowValue } from './test/row-value.enum.js';
import { RunCount } from './test/run-count.enum.js';
import { RunnerWrapperHarness } from './test/runner-wrapper-harness.util.js';
import { TimeoutBudget } from './test/timeout-budget.enum.js';

describe('RunnerWrapper — runner arguments', () => {
  it('a node that forwards nothing gives the body only its run context', async () => {
    const runner = new NeutralRunnerFake();
    const received: unknown[][] = [];
    RunnerWrapperHarness.wrap(runner).it(
      NeutralName.Test,
      GateHarness.smoke,
      (_t: RunAssertions, ...rest: unknown[]) => {
        received.push(rest);
      },
    );
    await runner.run();
    expect(received).toEqual([[]]);
  });

  it('a registrar that forwards everything passes every row value after t', async () => {
    const runner = new NeutralRunnerFake();
    const received: unknown[][] = [];
    RunnerWrapperHarness.wrap(runner).it.rows([[RowValue.Apples, RunCount.Smaller]])(
      NeutralName.Test,
      GateHarness.smoke,
      (_t: RunAssertions, ...rest: unknown[]) => {
        received.push(rest);
      },
    );
    await runner.run();
    expect(received).toEqual([[RowValue.Apples, RunCount.Smaller]]);
  });

  it('a registrar that forwards the first argument passes the row alone after t', async () => {
    const runner = new NeutralRunnerFake();
    const received: unknown[][] = [];
    RunnerWrapperHarness.wrap(runner).it.pairs([{ fruit: RowValue.Pears }])(
      NeutralName.Test,
      GateHarness.smoke,
      (_t: RunAssertions, ...rest: unknown[]) => {
        received.push(rest);
      },
    );
    await runner.run();
    expect(received).toEqual([[{ fruit: RowValue.Pears }]]);
  });

  it('a focused chain keeps the table node of its parent family', async () => {
    const runner = new NeutralRunnerFake();
    const received: unknown[][] = [];
    RunnerWrapperHarness.wrap(runner).it.focus.rows([[RowValue.Apples]])(
      NeutralName.Test,
      GateHarness.smoke,
      (_t: RunAssertions, ...rest: unknown[]) => {
        received.push(rest);
      },
    );
    await runner.run();
    expect(received).toEqual([[RowValue.Apples]]);
  });

  it('a group node that forwards nothing calls the callback without runner arguments', () => {
    const runner = new NeutralRunnerFake();
    const received: unknown[][] = [];
    RunnerWrapperHarness.wrap(runner).describe(NeutralName.Group, (...args: unknown[]) => {
      received.push(args);
    });
    expect(received).toEqual([[]]);
  });

  it('a group table forwards its row values to the callback', () => {
    const runner = new NeutralRunnerFake();
    const received: unknown[][] = [];
    RunnerWrapperHarness.wrap(runner).describe.rows([[RowValue.Apples], [RowValue.Pears]])(
      NeutralName.Group,
      (...args: unknown[]) => {
        received.push(args);
      },
    );
    expect(received).toEqual([[RowValue.Apples], [RowValue.Pears]]);
  });
});

describe('RunnerWrapper — registration', () => {
  it('tests declared inside a group run the group run count', async () => {
    const runner = new NeutralRunnerFake();
    const { it: test, describe: group } = RunnerWrapperHarness.wrap(runner);
    let executed = 0;
    group(NeutralName.Group, { runs: RunCount.Smaller }, () => {
      test(NeutralName.Test, async () => {
        executed += 1;
      });
    });
    await runner.run();
    expect(executed).toBe(RunCount.Smaller);
  });

  it('gives the runner the test timeout plus the margin on every registering node', () => {
    const runner = new NeutralRunnerFake();
    const { it: test } = RunnerWrapperHarness.wrap(runner);
    test(NeutralName.Test, async () => {}, CustomTimeout.Long);
    test.rows([[RowValue.Apples]])(NeutralName.Test, async () => {}, CustomTimeout.Long);
    test.pairs([RowValue.Pears])(NeutralName.Test, async () => {}, CustomTimeout.Long);
    expect(runner.timeouts()).toEqual(
      Array.from({ length: 3 }, () => CustomTimeout.Long + TimeoutBudget.CeilingMarginMs),
    );
  });

  it('a passthrough node hands its arguments to the runner unchanged', () => {
    const runner = new NeutralRunnerFake();
    RunnerWrapperHarness.wrap(runner).it.plan(NeutralName.Planned);
    expect(runner.names()).toEqual([NeutralName.Planned]);
  });

  it('a missing runner function is a usage error when a test is declared', () => {
    const runner = new NeutralRunnerFake();
    const { it: test } = RunnerWrapperHarness.wrap(runner, false);
    expect(RunnerWrapperHarness.errorFrom(() => test(NeutralName.Test, async () => {})).kind).toBe(
      'usage',
    );
  });
});

describe('RunnerWrapper — properties', () => {
  it.each([NeutralProperty.Inverted, NeutralProperty.Extra])(
    '%s, which the runner has but the spec does not wrap, is a usage error on access',
    (property) => {
      const { it: test } = RunnerWrapperHarness.wrap(new NeutralRunnerFake());
      expect(RunnerWrapperHarness.errorFrom(() => test[property]).kind).toBe('usage');
    },
  );

  it('a property neither the spec nor the runner has is undefined', () => {
    const { describe: group } = RunnerWrapperHarness.wrap(new NeutralRunnerFake());
    expect(group[NeutralProperty.Absent]).toBeUndefined();
  });

  it('a variant name from the other family is a usage error where it does not belong', () => {
    const { describe: group } = RunnerWrapperHarness.wrap(new NeutralRunnerFake());
    expect(RunnerWrapperHarness.errorFrom(() => group.pairs).kind).toBe('usage');
  });
});
