import { describe, expect, it } from '@jest/globals';
import type { RunAssertions } from '../core/run-assertions.js';
import { RunScope } from '../core/state.js';
import { CustomTimeout } from '../core/test/custom-timeout.enum.js';
import { GateHarness } from '../core/test/gate-harness.util.js';
import { ProjectDefaults } from '../core/test/project-defaults.util.js';
import { RowValue } from '../core/test/row-value.enum.js';
import { RunCount } from '../core/test/run-count.enum.js';
import { StateFact } from '../core/test/state-fact.enum.js';
import { Threshold } from '../core/test/threshold.enum.js';
import { TimeoutBudget } from '../core/test/timeout-budget.enum.js';
import type { WrappedRunner } from './test/jest-harness.util.js';
import { TestName } from './test/test-name.enum.js';
import { OverlapProbe } from './test/overlap-probe.util.js';
import { TestStatus } from './test/test-status.enum.js';
import { UnlinkedSuiteRunnerFake } from './test/unlinked-suite-runner.fake.js';
import { VitestBindingHarness } from './test/vitest-harness.util.js';
import { VitestProperty } from './test/vitest-property.enum.js';
import { VitestRunnerFake } from './test/vitest-runner.fake.js';

describe('VitestBinding — crucible.it', () => {
  it('drops the Vitest test context, so the body receives only its run context t', async () => {
    const runner = new VitestRunnerFake();
    const received: unknown[][] = [];
    VitestBindingHarness.variants(runner).it(
      TestName.Plain,
      GateHarness.smoke,
      async (t: RunAssertions, ...rest: unknown[]) => {
        t.facts(StateFact.Casino);
        await GateHarness.requireSeen(t);
        received.push(rest);
      },
    );
    expect(await runner.run()).toEqual([{ name: TestName.Plain, status: TestStatus.Passed }]);
    expect(received).toEqual([[]]);
  });

  it('runs the body the declared number of runs', async () => {
    const runner = new VitestRunnerFake();
    let executed = 0;
    VitestBindingHarness.variants(runner).it(TestName.Plain, { runs: RunCount.Smaller }, () => {
      executed += 1;
    });
    await runner.run();
    expect(executed).toBe(RunCount.Smaller);
  });

  it('a test without options runs the configured run count', async () => {
    const runner = new VitestRunnerFake();
    let executed = 0;
    VitestBindingHarness.variants(runner, new RunScope(), ProjectDefaults.strictGate).it(
      TestName.Plain,
      () => {
        executed += 1;
      },
    );
    await runner.run();
    expect(executed).toBe(RunCount.Gated);
  });

  it('a failing run count fails the test', async () => {
    const runner = new VitestRunnerFake();
    VitestBindingHarness.variants(runner).it(TestName.Plain, GateHarness.smoke, () => {
      throw new Error('the run misses');
    });
    expect(await runner.run()).toEqual([{ name: TestName.Plain, status: TestStatus.Failed }]);
  });

  it('it.only focuses its test, it.skip skips and it.todo plans', async () => {
    const runner = new VitestRunnerFake();
    const { it: test } = VitestBindingHarness.variants(runner);
    test(TestName.Plain, GateHarness.smoke, async () => {});
    test.only(TestName.Focused, GateHarness.smoke, async () => {});
    test.skip(TestName.Skipped, GateHarness.smoke, async () => {});
    test.todo(TestName.Planned);
    expect(await runner.run()).toEqual([
      { name: TestName.Plain, status: TestStatus.Skipped },
      { name: TestName.Focused, status: TestStatus.Passed },
      { name: TestName.Skipped, status: TestStatus.Skipped },
      { name: TestName.Planned, status: TestStatus.Todo },
    ]);
  });

  it.each<[string, (test: WrappedRunner['it']) => WrappedRunner['it']]>([
    ['the test', (test) => test],
    ['it.only', (test) => test.only],
    ['it.skip', (test) => test.skip],
    ['it.skipIf', (test) => test.skipIf(false)],
    ['it.runIf', (test) => test.runIf(true)],
    ['it.each', (test) => test.each([[RowValue.Apples]])],
    ['it.for', (test) => test.for([[RowValue.Pears]])],
    ['it.only.each', (test) => test.only.each([[RowValue.Apples]])],
    ['it.skip.for', (test) => test.skip.for([[RowValue.Pears]])],
  ])('gives Vitest the test timeout plus the margin for %s', (_label, variant) => {
    const runner = new VitestRunnerFake();
    variant(VitestBindingHarness.variants(runner).it)(
      TestName.Plain,
      async () => {},
      CustomTimeout.Long,
    );
    expect(runner.timeoutOf(TestName.Plain)).toBe(
      CustomTimeout.Long + TimeoutBudget.CeilingMarginMs,
    );
  });
});

describe('VitestBinding — tables', () => {
  it('it.each passes the row values after t, with the runner’s name formatting', async () => {
    const runner = new VitestRunnerFake();
    const received: unknown[][] = [];
    VitestBindingHarness.variants(runner).it.each([
      [RowValue.Apples, RunCount.Smaller],
      [RowValue.Pears, RunCount.Single],
    ])(TestName.Row, GateHarness.smoke, async (_t: RunAssertions, ...row: unknown[]) => {
      received.push(row);
    });
    expect(await runner.run()).toEqual([
      { name: `counts ${RowValue.Apples}`, status: TestStatus.Passed },
      { name: `counts ${RowValue.Pears}`, status: TestStatus.Passed },
    ]);
    expect(received).toEqual([
      [RowValue.Apples, RunCount.Smaller],
      [RowValue.Pears, RunCount.Single],
    ]);
  });

  it('it.each passes an object row as the one argument after t', async () => {
    const runner = new VitestRunnerFake();
    const received: unknown[][] = [];
    VitestBindingHarness.variants(runner).it.each([{ fruit: RowValue.Pears }])(
      TestName.ObjectRow,
      GateHarness.smoke,
      async (_t: RunAssertions, ...row: unknown[]) => {
        received.push(row);
      },
    );
    await runner.run();
    expect(received).toEqual([[{ fruit: RowValue.Pears }]]);
  });

  it('it.for passes the whole row as one argument after t and drops the test context', async () => {
    const runner = new VitestRunnerFake();
    const received: unknown[][] = [];
    VitestBindingHarness.variants(runner).it.for([[RowValue.Apples, RunCount.Smaller]])(
      TestName.Row,
      GateHarness.smoke,
      async (_t: RunAssertions, ...rest: unknown[]) => {
        received.push(rest);
      },
    );
    await runner.run();
    expect(received).toEqual([[[RowValue.Apples, RunCount.Smaller]]]);
  });

  it('it.only.each focuses its rows and it.skip.for skips its rows', async () => {
    const runner = new VitestRunnerFake();
    const { it: test } = VitestBindingHarness.variants(runner);
    test(TestName.Plain, GateHarness.smoke, async () => {});
    test.only.each([[RowValue.Apples]])(TestName.Row, GateHarness.smoke, async () => {});
    test.skip.for([[RowValue.Pears]])(TestName.Row, GateHarness.smoke, async () => {});
    expect(await runner.run()).toEqual([
      { name: TestName.Plain, status: TestStatus.Skipped },
      { name: `counts ${RowValue.Apples}`, status: TestStatus.Passed },
      { name: `counts ${RowValue.Pears}`, status: TestStatus.Skipped },
    ]);
  });

  it('it.only.for gives the body its row, it.skip.each never runs', async () => {
    const runner = new VitestRunnerFake();
    const { it: test } = VitestBindingHarness.variants(runner);
    const received: unknown[][] = [];
    test.only.for([RowValue.Apples])(
      TestName.Row,
      GateHarness.smoke,
      async (_t: RunAssertions, ...rest: unknown[]) => {
        received.push(rest);
      },
    );
    test.skip.each([[RowValue.Pears]])(TestName.Row, GateHarness.smoke, async () => {
      throw new Error('a skipped row must never run');
    });
    await runner.run();
    expect(received).toEqual([[RowValue.Apples]]);
  });
});

describe('VitestBinding — skipIf and runIf', () => {
  it.each<[string, (variants: WrappedRunner) => WrappedRunner['it'], TestStatus]>([
    ['skipIf(true)', (v) => v.it.skipIf(true), TestStatus.Skipped],
    ['skipIf(false)', (v) => v.it.skipIf(false), TestStatus.Passed],
    ['runIf(true)', (v) => v.it.runIf(true), TestStatus.Passed],
    ['runIf(false)', (v) => v.it.runIf(false), TestStatus.Skipped],
  ])('it.%s registers a test with that outcome', async (_label, registrar, status) => {
    const runner = new VitestRunnerFake();
    registrar(VitestBindingHarness.variants(runner))(TestName.Plain, GateHarness.smoke, () => {});
    expect(await runner.run()).toEqual([{ name: TestName.Plain, status }]);
  });

  it('a conditional test body receives only its run context t', async () => {
    const runner = new VitestRunnerFake();
    const received: unknown[][] = [];
    VitestBindingHarness.variants(runner).it.runIf(true)(
      TestName.Plain,
      GateHarness.smoke,
      (_t: RunAssertions, ...rest: unknown[]) => {
        received.push(rest);
      },
    );
    await runner.run();
    expect(received).toEqual([[]]);
  });

  it('describe.skipIf(true) skips the tests inside it', async () => {
    const runner = new VitestRunnerFake();
    const { it: test, describe: group } = VitestBindingHarness.variants(runner);
    group.skipIf(true)(TestName.Skipped, () => {
      test(TestName.Inside, GateHarness.smoke, async () => {});
    });
    expect(await runner.run()).toEqual([
      { name: `${TestName.Skipped} > ${TestName.Inside}`, status: TestStatus.Skipped },
    ]);
  });

  it('describe.runIf(true) keeps its options for the tests inside it', async () => {
    const runner = new VitestRunnerFake();
    const { it: test, describe: group } = VitestBindingHarness.variants(runner);
    let executed = 0;
    group.runIf(true)(TestName.Focused, { runs: RunCount.Smaller }, () => {
      test(TestName.Inside, () => {
        executed += 1;
      });
    });
    await runner.run();
    expect(executed).toBe(RunCount.Smaller);
  });
});

describe('VitestBinding — crucible.describe', () => {
  it('tests inside a group inherit its options although Vitest collects the group later', async () => {
    const runner = new VitestRunnerFake();
    const { it: test, describe: group } = VitestBindingHarness.variants(runner);
    let executed = 0;
    group(TestName.Group, { runs: RunCount.Smaller }, () => {
      test(TestName.Inside, () => {
        executed += 1;
      });
    });
    await runner.run();
    expect(executed).toBe(RunCount.Smaller);
  });

  it('a nested group keeps the outer options it does not override', async () => {
    const runner = new VitestRunnerFake();
    const { it: test, describe: group } = VitestBindingHarness.variants(runner);
    let executed = 0;
    group(TestName.Group, { runs: RunCount.Smaller, threshold: Threshold.Certain }, () => {
      group(TestName.Focused, { threshold: Threshold.Half }, () => {
        test(TestName.Inside, () => {
          executed += 1;
          throw new Error('every run misses');
        });
      });
    });
    expect((await runner.run()).map((result) => result.status)).toEqual([TestStatus.Failed]);
    expect(executed).toBe(RunCount.Smaller);
  });

  it('a plain Vitest describe inside a group keeps the inheritance', async () => {
    const runner = new VitestRunnerFake();
    const { it: test, describe: group } = VitestBindingHarness.variants(runner);
    let executed = 0;
    group(TestName.Group, { runs: RunCount.Smaller }, () => {
      runner.describe(TestName.Plain, () => {
        test(TestName.Inside, () => {
          executed += 1;
        });
      });
    });
    await runner.run();
    expect(executed).toBe(RunCount.Smaller);
  });

  it('settings do not reach a sibling group or a later test', async () => {
    const runner = new VitestRunnerFake();
    const { it: test, describe: group } = VitestBindingHarness.variants(runner);
    let executed = 0;
    const body = (): void => {
      executed += 1;
    };
    group(TestName.Group, { runs: RunCount.Smaller }, () => {});
    group(TestName.Plain, () => {
      test(TestName.Inside, body);
    });
    test(TestName.Plain, body);
    await runner.run();
    expect(executed).toBe(RunCount.BuiltIn * 2);
  });

  it('group callbacks receive no runner argument', () => {
    const runner = new VitestRunnerFake();
    const received: unknown[][] = [];
    VitestBindingHarness.variants(runner).describe(TestName.Group, (...args: unknown[]) => {
      received.push(args);
    });
    runner.collect();
    expect(received).toEqual([[]]);
  });

  it('describe.each forwards the row values and its tests inherit the group options', async () => {
    const runner = new VitestRunnerFake();
    const { it: test, describe: group } = VitestBindingHarness.variants(runner);
    const seen: unknown[][] = [];
    let executed = 0;
    group.each([[RowValue.Apples, RunCount.Single]])(
      TestName.Group,
      { runs: RunCount.Smaller },
      (...row: unknown[]) => {
        seen.push(row);
        test(TestName.Inside, () => {
          executed += 1;
        });
      },
    );
    expect(await runner.run()).toEqual([
      { name: `group ${RowValue.Apples} > inside`, status: TestStatus.Passed },
    ]);
    expect(seen).toEqual([[RowValue.Apples, RunCount.Single]]);
    expect(executed).toBe(RunCount.Smaller);
  });

  it('describe.for forwards the whole row as one argument', () => {
    const runner = new VitestRunnerFake();
    const seen: unknown[][] = [];
    VitestBindingHarness.variants(runner).describe.for([[RowValue.Pears, RunCount.Single]])(
      TestName.Group,
      (...row: unknown[]) => {
        seen.push(row);
      },
    );
    runner.collect();
    expect(seen).toEqual([[[RowValue.Pears, RunCount.Single]]]);
  });

  it('describe.only focuses, describe.skip skips and describe.todo plans', async () => {
    const runner = new VitestRunnerFake();
    const { it: test, describe: group } = VitestBindingHarness.variants(runner);
    test(TestName.Plain, GateHarness.smoke, async () => {});
    group.only(TestName.Focused, GateHarness.smoke, () => {
      test(TestName.Inside, async () => {});
    });
    group.skip(TestName.Skipped, () => {
      test(TestName.Inside, async () => {});
    });
    group.todo(TestName.Planned);
    expect(await runner.run()).toEqual([
      { name: TestName.Plain, status: TestStatus.Skipped },
      { name: `${TestName.Focused} > ${TestName.Inside}`, status: TestStatus.Passed },
      { name: `${TestName.Skipped} > ${TestName.Inside}`, status: TestStatus.Skipped },
    ]);
  });

  it('describe.only.each focuses its rows and describe.skip.for skips its rows', async () => {
    const runner = new VitestRunnerFake();
    const { it: test, describe: group } = VitestBindingHarness.variants(runner);
    test(TestName.Plain, GateHarness.smoke, async () => {});
    group.only.each([[RowValue.Apples]])(TestName.Group, GateHarness.smoke, () => {
      test(TestName.Inside, async () => {});
    });
    group.skip.for([[RowValue.Pears]])(TestName.Group, () => {
      test(TestName.Inside, async () => {});
    });
    expect((await runner.run()).map((result) => result.status)).toEqual([
      TestStatus.Skipped,
      TestStatus.Passed,
      TestStatus.Skipped,
    ]);
  });

  it('a Vitest whose suites no longer link their parent fails the group as usage', () => {
    const runner = new UnlinkedSuiteRunnerFake();
    VitestBindingHarness.variants(runner).describe(
      TestName.Group,
      { runs: RunCount.Smaller },
      () => {},
    );
    expect(VitestBindingHarness.errorFrom(() => runner.collect()).kind).toBe('usage');
  });

  it('rejects an async group callback as usage when Vitest collects it', () => {
    const runner = new VitestRunnerFake();
    VitestBindingHarness.variants(runner).describe(TestName.Group, async () => {});
    expect(VitestBindingHarness.errorFrom(() => runner.collect()).kind).toBe('usage');
  });
});

describe('VitestBinding — scheduling inherited from plain Vitest groups', () => {
  it('crucible tests inside a concurrent Vitest describe still run one at a time', async () => {
    const runner = new VitestRunnerFake();
    const { it: test } = VitestBindingHarness.variants(runner);
    const probe = new OverlapProbe();
    runner.describe.concurrent(TestName.Plain, () => {
      test(TestName.Inside, GateHarness.smoke, probe.body);
      test(TestName.Focused, GateHarness.smoke, probe.body);
    });
    await runner.run();
    expect(probe.overlapped).toBe(false);
  });

  it('a crucible.describe inside a shuffled Vitest describe keeps its declaration order', async () => {
    const runner = new VitestRunnerFake();
    const { it: test, describe: group } = VitestBindingHarness.variants(runner);
    runner.describe.shuffle(TestName.Plain, () => {
      group(TestName.Group, GateHarness.smoke, () => {
        test(TestName.Inside, async () => {});
        test(TestName.Focused, async () => {});
      });
    });
    const names = (await runner.run()).map((result) => result.name);
    expect(names).toEqual([
      `${TestName.Plain} > ${TestName.Group} > ${TestName.Inside}`,
      `${TestName.Plain} > ${TestName.Group} > ${TestName.Focused}`,
    ]);
  });
});

describe('VitestBinding — blocked and unknown variants', () => {
  it.each<[string, (variants: WrappedRunner) => unknown]>([
    ['it.fails', (v) => v.it[VitestProperty.Fails]],
    ['it.concurrent', (v) => v.it[VitestProperty.Concurrent]],
    ['it.only.fails', (v) => v.it.only[VitestProperty.Fails]],
    ['describe.concurrent', (v) => v.describe[VitestProperty.Concurrent]],
    ['describe.shuffle', (v) => v.describe[VitestProperty.Shuffle]],
    ['describe.sequential', (v) => v.describe[VitestProperty.Sequential]],
    ['describe.skip.shuffle', (v) => v.describe.skip[VitestProperty.Shuffle]],
    ['a runner function Crucible does not wrap', (v) => v.it[VitestProperty.Extend]],
    ['it.each.only', (v) => v.it.each.only],
  ])('%s is a usage error on access', (_label, access) => {
    const variants = VitestBindingHarness.variants(new VitestRunnerFake());
    expect(VitestBindingHarness.errorFrom(() => access(variants)).kind).toBe('usage');
  });

  it('a missing Vitest test function is a usage error when a test is declared', () => {
    const variants = VitestBindingHarness.over({ currentGroup: () => undefined });
    expect(
      VitestBindingHarness.errorFrom(() => variants.it(TestName.Plain, async () => {})).kind,
    ).toBe('usage');
  });
});
