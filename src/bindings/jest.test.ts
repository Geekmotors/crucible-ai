import { inspect } from 'node:util';
import { describe, expect, it } from '@jest/globals';
import { CrucibleError } from '../core/errors.js';
import type { RunOptions } from '../core/run-options.js';
import type { RunAssertions } from '../core/run-assertions.js';
import { RunScope } from '../core/state.js';
import { GateHarness } from '../core/test/gate-harness.util.js';
import { StateFact } from '../core/test/state-fact.enum.js';
import { Capture } from '../core/test/capture.util.js';
import { ExtractValue } from '../core/test/extract-value.enum.js';
import { ProjectDefaults } from '../core/test/project-defaults.util.js';
import { RunCount } from '../core/test/run-count.enum.js';
import { RunnerHarness } from '../core/test/runner-harness.util.js';
import { Threshold } from '../core/test/threshold.enum.js';
import { TimeoutBudget } from '../core/test/timeout-budget.enum.js';
import { CrucibleVerdictError } from '../core/verdict-error.js';
import { CustomTimeout } from '../core/test/custom-timeout.enum.js';
import { InvalidTimeout } from '../core/test/invalid-timeout.enum.js';
import { ManualTimer } from '../core/test/manual-timer.fake.js';
import { DescribeRegistrarFake } from './test/describe-registrar.fake.js';
import { GroupName } from './test/group-name.enum.js';
import { InvalidOption } from './test/invalid-option.enum.js';
import { JestBindingHarness } from './test/jest-harness.util.js';
import type { BindingUnderTest, WrappedRunner } from './test/jest-harness.util.js';
import { RegistrarFake } from './test/registrar.fake.js';
import { RowValue } from '../core/test/row-value.enum.js';
import { FakeRunner } from './test/fake-runner.fake.js';
import { RunnerProperty } from './test/runner-property.enum.js';
import { TestName } from './test/test-name.enum.js';
import { TestStatus } from './test/test-status.enum.js';
import { VariantPath } from './test/variant-path.enum.js';

describe('JestBinding', () => {
  it('passes each run its own run context t', async () => {
    const registrar = new RegistrarFake();
    JestBindingHarness.binding(registrar).register(
      'with t',
      GateHarness.smoke,
      async (t: RunAssertions) => {
        t.facts(StateFact.Casino);
        await GateHarness.requireSeen(t);
      },
    );
    await expect(registrar.registrations[0]!.fn()).resolves.toBeUndefined();
  });

  it('registers exactly one test per declaration', () => {
    const registrar = new RegistrarFake();
    JestBindingHarness.binding(registrar).register('checks coherence', async () => {});
    expect(registrar.registrations).toHaveLength(1);
    expect(registrar.registrations[0]?.name).toBe('checks coherence');
  });

  it('a declaration omitting runs gets a Jest timeout a configured run count cannot undercut', () => {
    const registrar = new RegistrarFake();
    JestBindingHarness.binding(registrar).register('defaults', async () => {});
    expect(registrar.registrations[0]?.timeout).toBeGreaterThan(
      JestBindingHarness.runnerBudget(RunCount.Hundred),
    );
  });

  it.each<[RunOptions]>([[{}], [{ runs: RunCount.BeyondTimerMax }]])(
    'never registers a Jest timeout beyond the timer maximum for %j',
    (opts) => {
      const registrar = new RegistrarFake();
      JestBindingHarness.binding(registrar).register('bounded', opts, async () => {});
      expect(registrar.registrations[0]?.timeout).toBeLessThanOrEqual(TimeoutBudget.TimerMaxMs);
    },
  );

  it('declared runs get a Jest timeout above the runner deadline, so the runner verdict wins', () => {
    const registrar = new RegistrarFake();
    JestBindingHarness.binding(registrar).register(
      'gated',
      { runs: RunCount.Gated, threshold: Threshold.Strict },
      async () => {},
    );
    expect(registrar.registrations[0]?.timeout).toBeGreaterThan(
      JestBindingHarness.runnerBudget(RunCount.Gated),
    );
  });

  it('registration never reads the project defaults', () => {
    const registrar = new RegistrarFake();
    const runner = RunnerHarness.failingDefaultsRunner(new CrucibleError('config', 'bad'));
    expect(() =>
      JestBindingHarness.over(runner, registrar).register('inert', async () => {}),
    ).not.toThrow();
  });

  it('a test omitting runs executes the configured run count', async () => {
    const registrar = new RegistrarFake();
    let executed = 0;
    JestBindingHarness.binding(registrar, new RunScope(), ProjectDefaults.strictGate).register(
      'defaults',
      async () => {
        executed += 1;
      },
    );
    await registrar.registrations[0]?.fn();
    expect(executed).toBe(RunCount.Gated);
  });

  it('inert registration — body must not run until the framework invokes the test', () => {
    const registrar = new RegistrarFake();
    let ran = false;
    JestBindingHarness.binding(registrar).register('inert', async () => {
      ran = true;
    });
    expect(ran).toBe(false);
  });

  it('runs the body 10 times when the test declares no options', async () => {
    const registrar = new RegistrarFake();
    const scope = new RunScope();
    let runs = 0;
    JestBindingHarness.binding(registrar, scope).register('unconfigured', async () => {
      runs += 1;
    });
    await registrar.registrations[0]?.fn();
    expect(runs).toBe(RunCount.BuiltIn);
  });

  it('accepts an empty options object between name and body', async () => {
    const registrar = new RegistrarFake();
    let ran = false;
    JestBindingHarness.binding(registrar).register('with options', {}, async () => {
      ran = true;
    });
    await registrar.registrations[0]?.fn();
    expect(registrar.registrations).toHaveLength(1);
    expect(ran).toBe(true);
  });

  it('registers once and executes the body runs times when invoked', async () => {
    const registrar = new RegistrarFake();
    let executed = 0;
    JestBindingHarness.binding(registrar).register(
      'gated',
      { runs: RunCount.Gated, threshold: Threshold.Strict },
      async () => {
        executed += 1;
      },
    );
    expect(registrar.registrations).toHaveLength(1);
    await registrar.registrations[0]?.fn();
    expect(executed).toBe(RunCount.Gated);
  });

  it.each<[RunOptions]>([
    [{ threshold: InvalidOption.Zero }],
    [{ threshold: InvalidOption.ThresholdAboveOne }],
    [{ threshold: Number.NaN }],
    [{ runs: InvalidOption.Zero }],
    [{ runs: InvalidOption.FractionalRuns }],
  ])('rejects invalid options %j as usage at registration, registering nothing', (opts) => {
    const registrar = new RegistrarFake();
    const error = JestBindingHarness.errorFrom(() =>
      JestBindingHarness.binding(registrar).register('invalid', opts, async () => {}),
    );
    expect(error.kind).toBe('usage');
    expect(registrar.registrations).toHaveLength(0);
  });

  it('rejects an unknown option key as a usage error at registration', () => {
    const registrar = new RegistrarFake();
    const error = JestBindingHarness.errorFrom(() =>
      JestBindingHarness.binding(registrar).register(
        'typo',
        { run: 5 } as unknown as RunOptions,
        async () => {},
      ),
    );
    expect(error.kind).toBe('usage');
  });

  it('rejects a non-function body as a usage error', () => {
    const registrar = new RegistrarFake();
    const error = JestBindingHarness.errorFrom(() =>
      JestBindingHarness.binding(registrar).register(
        'bad',
        {},
        'not a body' as unknown as () => void,
      ),
    );
    expect(error.kind).toBe('usage');
  });

  it('rejects a body passed in both positions as a usage error', () => {
    const registrar = new RegistrarFake();
    const error = JestBindingHarness.errorFrom(() =>
      JestBindingHarness.binding(registrar).register(
        'double',
        (async () => {}) as never,
        async () => {},
      ),
    );
    expect(error.kind).toBe('usage');
  });

  it('a body rejection surfaces as a verdict error carrying the original failure', async () => {
    const registrar = new RegistrarFake();
    const failure = new Error('assertion failed');
    JestBindingHarness.binding(registrar).register('failing', async () => {
      throw failure;
    });
    const registration = registrar.registrations[0];
    expect(registration).toBeDefined();
    const error = await Capture.rejection(registration!.fn());
    expect(error).toBeInstanceOf(CrucibleVerdictError);
    expect((error as CrucibleVerdictError).cause).toBe(failure);
  });
});

describe('JestBinding — test timeout', () => {
  it.each<[string, (binding: BindingUnderTest) => void]>([
    [
      'a trailing number after the body',
      (b) => b.register('t', async () => {}, CustomTimeout.Long),
    ],
    [
      'a trailing number after options and body',
      (b) => b.register('t', { runs: RunCount.Gated }, async () => {}, CustomTimeout.Long),
    ],
    [
      'a declared testTimeout',
      (b) => b.register('t', { testTimeout: CustomTimeout.Long }, async () => {}),
    ],
  ])('%s sets the Jest timeout to the test timeout plus the margin', (_label, declare) => {
    expect(JestBindingHarness.registeredTimeout(declare)).toBe(
      CustomTimeout.Long + TimeoutBudget.CeilingMarginMs,
    );
  });

  it.each<[string, (binding: BindingUnderTest, body: () => Promise<void>) => void]>([
    ['after the body', (b, body) => b.register('short', body, CustomTimeout.Short)],
    [
      'after options and body',
      (b, body) => b.register('short', { runs: RunCount.Gated }, body, CustomTimeout.Short),
    ],
  ])('a trailing number %s is the runner deadline for the whole test', async (_label, declare) => {
    const registrar = new RegistrarFake();
    const timer = new ManualTimer();
    declare(
      JestBindingHarness.binding(registrar, new RunScope(), {}, timer),
      () => new Promise<void>(() => {}),
    );
    const pending = Capture.rejection(registrar.registrations[0]!.fn());
    timer.advance(CustomTimeout.Short);
    expect(((await pending) as CrucibleVerdictError).outcome).toBe('errored');
  });

  it('declared runs leave Jest room for a longer configured test timeout', () => {
    const timeout = JestBindingHarness.registeredTimeout(
      (b) => b.register('gated', { runs: RunCount.Gated }, async () => {}),
      { testTimeout: CustomTimeout.Longer },
    );
    expect(timeout).toBeGreaterThan(CustomTimeout.Longer);
  });

  it('never registers a Jest timeout beyond the timer maximum for the largest test timeout', () => {
    expect(
      JestBindingHarness.registeredTimeout((b) =>
        b.register('max', async () => {}, TimeoutBudget.TimerMaxMs),
      ),
    ).toBeLessThanOrEqual(TimeoutBudget.TimerMaxMs);
  });

  it.each([
    InvalidTimeout.Zero,
    InvalidTimeout.Negative,
    InvalidTimeout.Fractional,
    InvalidTimeout.AboveTimerMax,
  ])('rejects a trailing number of %d as usage, registering nothing', (timeout) => {
    const registrar = new RegistrarFake();
    const error = JestBindingHarness.errorFrom(() =>
      JestBindingHarness.binding(registrar).register('bad', async () => {}, timeout),
    );
    expect(error.kind).toBe('usage');
    expect(registrar.registrations).toHaveLength(0);
  });

  it.each<[string, unknown]>([
    ['a numeric string', String(CustomTimeout.Short)],
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['null', null],
  ])('rejects %s as the trailing timeout as usage, registering nothing', (_label, timeout) => {
    const registrar = new RegistrarFake();
    const error = JestBindingHarness.errorFrom(() =>
      JestBindingHarness.binding(registrar).register(
        'bad',
        { runs: RunCount.Gated },
        async () => {},
        timeout as number,
      ),
    );
    expect(error.kind).toBe('usage');
    expect(registrar.registrations).toHaveLength(0);
  });

  it('rejects a timeout after an empty body slot as usage', () => {
    const registrar = new RegistrarFake();
    const error = JestBindingHarness.errorFrom(() =>
      JestBindingHarness.binding(registrar).register(
        'gap',
        async () => {},
        undefined,
        CustomTimeout.Short,
      ),
    );
    expect(error.kind).toBe('usage');
  });

  it('rejects a trailing number together with a declared testTimeout as usage', () => {
    const registrar = new RegistrarFake();
    const error = JestBindingHarness.errorFrom(() =>
      JestBindingHarness.binding(registrar).register(
        'both',
        { testTimeout: CustomTimeout.Long },
        async () => {},
        CustomTimeout.Short,
      ),
    );
    expect(error.kind).toBe('usage');
  });

  it('rejects an argument after the trailing number as usage', () => {
    const registrar = new RegistrarFake();
    const error = JestBindingHarness.errorFrom(() =>
      JestBindingHarness.binding(registrar).register(
        'surplus',
        async () => {},
        CustomTimeout.Short,
        CustomTimeout.Long,
      ),
    );
    expect(error.kind).toBe('usage');
  });

  it('rejects a trailing number in place of the body as usage', () => {
    const registrar = new RegistrarFake();
    const error = JestBindingHarness.errorFrom(() =>
      JestBindingHarness.binding(registrar).register(
        'no body',
        {},
        CustomTimeout.Short as unknown as () => void,
      ),
    );
    expect(error.kind).toBe('usage');
  });
});

describe('JestBinding — extraction strictness through the chain', () => {
  it('a strict group makes its tests extract strictly over a lenient configuration', async () => {
    await expect(
      JestBindingHarness.extractedInGroup({ strict: true }, {}, { strict: false }),
    ).resolves.toBeNull();
  });

  it('a lenient group relaxes a strict configuration', async () => {
    await expect(
      JestBindingHarness.extractedInGroup({ strict: false }, {}, { strict: true }),
    ).resolves.toBe(ExtractValue.Two);
  });

  it("a test's own strict wins over its group", async () => {
    await expect(
      JestBindingHarness.extractedInGroup({ strict: false }, { strict: true }),
    ).resolves.toBeNull();
  });

  it('rejects a non-boolean strict on a test as usage', () => {
    const binding = JestBindingHarness.binding(new RegistrarFake());
    const error = JestBindingHarness.errorFrom(() =>
      binding.register(
        GroupName.Invalid,
        { strict: String(true) } as unknown as RunOptions,
        async () => {},
      ),
    );
    expect(error.kind).toBe('usage');
  });
});

describe('JestBinding — group settings', () => {
  it('registers one describe block under the given name', () => {
    const describes = new DescribeRegistrarFake();
    JestBindingHarness.binding(
      new RegistrarFake(),
      new RunScope(),
      {},
      new ManualTimer(),
      describes,
    ).group(GroupName.Checkout, () => {});
    expect(describes.names).toEqual([GroupName.Checkout]);
  });

  it('collects the tests declared in the callback', () => {
    const registrar = new RegistrarFake();
    const binding = JestBindingHarness.binding(registrar);
    binding.group(GroupName.Checkout, () => {
      binding.register('first', async () => {});
      binding.register('second', async () => {});
    });
    expect(registrar.registrations).toHaveLength(2);
  });

  it('a test inside a group executes the group run count', async () => {
    const registrar = new RegistrarFake();
    const binding = JestBindingHarness.binding(registrar);
    let executed = 0;
    binding.group(GroupName.Checkout, { runs: RunCount.Smaller }, () => {
      binding.register('inherits', async () => {
        executed += 1;
      });
    });
    await registrar.registrations[0]?.fn();
    expect(executed).toBe(RunCount.Smaller);
  });

  it('group settings take precedence over the configured defaults', async () => {
    const registrar = new RegistrarFake();
    const binding = JestBindingHarness.binding(
      registrar,
      new RunScope(),
      ProjectDefaults.strictGate,
    );
    let executed = 0;
    binding.group(GroupName.Checkout, { runs: RunCount.Smaller }, () => {
      binding.register('inherits', async () => {
        executed += 1;
      });
    });
    await registrar.registrations[0]?.fn();
    expect(executed).toBe(RunCount.Smaller);
  });

  it("a test's own runs win over its group", async () => {
    const registrar = new RegistrarFake();
    const binding = JestBindingHarness.binding(registrar);
    let executed = 0;
    binding.group(GroupName.Checkout, { runs: RunCount.Gated }, () => {
      binding.register('own', { runs: RunCount.Single }, async () => {
        executed += 1;
      });
    });
    await registrar.registrations[0]?.fn();
    expect(executed).toBe(RunCount.Single);
  });

  it('plain describe blocks inside and around a group keep inheritance', async () => {
    const registrar = new RegistrarFake();
    const describes = new DescribeRegistrarFake();
    const binding = JestBindingHarness.binding(
      registrar,
      new RunScope(),
      {},
      new ManualTimer(),
      describes,
    );
    let executed = 0;
    describes.register('plain outer', () => {
      binding.group('group', { runs: RunCount.Smaller }, () => {
        describes.register('plain inner', () => {
          binding.register('deep', async () => {
            executed += 1;
          });
        });
      });
    });
    await registrar.registrations[0]?.fn();
    expect(executed).toBe(RunCount.Smaller);
  });

  it('settings do not leak into a sibling group or later tests', async () => {
    const registrar = new RegistrarFake();
    const binding = JestBindingHarness.binding(registrar);
    let executed = 0;
    const body = async (): Promise<void> => {
      executed += 1;
    };
    binding.group('first', { runs: RunCount.Smaller }, () => {});
    binding.group('second', () => {
      binding.register('sibling', body);
    });
    binding.register('after', body);
    await registrar.registrations[0]?.fn();
    await registrar.registrations[1]?.fn();
    expect(executed).toBe(RunCount.BuiltIn * 2);
  });

  it('a usage error inside a group propagates and the group settings end with it', async () => {
    const registrar = new RegistrarFake();
    const binding = JestBindingHarness.binding(registrar);
    const error = JestBindingHarness.errorFrom(() =>
      binding.group('broken', { runs: RunCount.Smaller }, () => {
        binding.register('invalid', { runs: InvalidOption.Zero }, async () => {});
      }),
    );
    let executed = 0;
    binding.register('after', async () => {
      executed += 1;
    });
    await registrar.registrations[0]?.fn();
    expect(error.kind).toBe('usage');
    expect(executed).toBe(RunCount.BuiltIn);
  });

  it('a group testTimeout sets the Jest timeout of the tests inside it', () => {
    const timeout = JestBindingHarness.registeredTimeout((binding) =>
      binding.group(GroupName.Slow, { testTimeout: CustomTimeout.Long }, () => {
        binding.register('t', async () => {});
      }),
    );
    expect(timeout).toBe(CustomTimeout.Long + TimeoutBudget.CeilingMarginMs);
  });

  it('a group testTimeout is the runner deadline of the tests inside it', async () => {
    const registrar = new RegistrarFake();
    const timer = new ManualTimer();
    const binding = JestBindingHarness.binding(registrar, new RunScope(), {}, timer);
    binding.group(GroupName.Slow, { testTimeout: CustomTimeout.Short }, () => {
      binding.register('hangs', () => new Promise<void>(() => {}));
    });
    const pending = Capture.rejection(registrar.registrations[0]!.fn());
    timer.advance(CustomTimeout.Short);
    expect(((await pending) as CrucibleVerdictError).outcome).toBe('errored');
  });

  it('a trailing timeout inside a group with a testTimeout is allowed and wins', async () => {
    const registrar = new RegistrarFake();
    const timer = new ManualTimer();
    const binding = JestBindingHarness.binding(registrar, new RunScope(), {}, timer);
    binding.group(GroupName.Slow, { testTimeout: CustomTimeout.Longer }, () => {
      binding.register('hangs', () => new Promise<void>(() => {}), CustomTimeout.Short);
    });
    const pending = Capture.rejection(registrar.registrations[0]!.fn());
    timer.advance(CustomTimeout.Short);
    expect(((await pending) as CrucibleVerdictError).outcome).toBe('errored');
  });

  it('a trailing timeout with a testTimeout in the same test options stays usage inside a group', () => {
    const registrar = new RegistrarFake();
    const binding = JestBindingHarness.binding(registrar);
    const error = JestBindingHarness.errorFrom(() =>
      binding.group(GroupName.Slow, { testTimeout: CustomTimeout.Longer }, () => {
        binding.register(
          'both',
          { testTimeout: CustomTimeout.Long },
          async () => {},
          CustomTimeout.Short,
        );
      }),
    );
    expect(error.kind).toBe('usage');
  });

  it.each<[unknown]>([
    [{ runs: InvalidOption.Zero }],
    [{ threshold: InvalidOption.ThresholdAboveOne }],
    [{ run: RunCount.Smaller }],
    [null],
  ])('rejects group options %j as usage', (options) => {
    const binding = JestBindingHarness.binding(new RegistrarFake());
    const error = JestBindingHarness.errorFrom(() =>
      binding.group(GroupName.Invalid, options as RunOptions, () => {}),
    );
    expect(error.kind).toBe('usage');
  });

  it.each<[unknown]>([[{ runs: InvalidOption.Zero }], [null]])(
    'registers no describe block for invalid group options %j',
    (options) => {
      const describes = new DescribeRegistrarFake();
      const binding = JestBindingHarness.binding(
        new RegistrarFake(),
        new RunScope(),
        {},
        new ManualTimer(),
        describes,
      );
      Capture.thrown(() => binding.group(GroupName.Invalid, options as RunOptions, () => {}));
      expect(describes.names).toHaveLength(0);
    },
  );

  it.each<[string, (binding: BindingUnderTest) => void]>([
    ['a missing callback', (b) => b.group(GroupName.Invalid, undefined as unknown as () => void)],
    [
      'options without a callback',
      (b) => b.group(GroupName.Invalid, {}, undefined as unknown as () => void),
    ],
    [
      'a non-function callback',
      (b) => b.group(GroupName.Invalid, {}, 'body' as unknown as () => void),
    ],
    [
      'an argument after the callback',
      (b) =>
        b.group(
          GroupName.Invalid,
          () => {},
          () => {},
        ),
    ],
    [
      'an argument after options and callback',
      (b) => b.group(GroupName.Invalid, {}, () => {}, GroupName.Slow),
    ],
  ])('rejects %s as usage', (_label, declare) => {
    const describes = new DescribeRegistrarFake();
    const binding = JestBindingHarness.binding(
      new RegistrarFake(),
      new RunScope(),
      {},
      new ManualTimer(),
      describes,
    );
    const error = JestBindingHarness.errorFrom(() => declare(binding));
    expect(error.kind).toBe('usage');
    expect(describes.names).toHaveLength(0);
  });

  it('rejects an async callback as usage', () => {
    const binding = JestBindingHarness.binding(new RegistrarFake());
    const error = JestBindingHarness.errorFrom(() => binding.group('async', async () => {}));
    expect(error.kind).toBe('usage');
  });
});

describe('crucible.it variants', () => {
  it('it.only focuses its test so the others do not run', async () => {
    const runner = new FakeRunner();
    const { it: test } = JestBindingHarness.variants(runner);
    test(TestName.Plain, GateHarness.smoke, async () => {});
    test.only(TestName.Focused, GateHarness.smoke, async () => {});
    expect(await runner.run()).toEqual([
      { name: TestName.Plain, status: TestStatus.Skipped },
      { name: TestName.Focused, status: TestStatus.Passed },
    ]);
  });

  it('it.skip never runs its body', async () => {
    const runner = new FakeRunner();
    let executed = 0;
    JestBindingHarness.variants(runner).it.skip(TestName.Skipped, async () => {
      executed += 1;
    });
    expect(await runner.run()).toEqual([{ name: TestName.Skipped, status: TestStatus.Skipped }]);
    expect(executed).toBe(0);
  });

  it('it.todo plans a test without a body', async () => {
    const runner = new FakeRunner();
    JestBindingHarness.variants(runner).it.todo(TestName.Planned);
    expect(await runner.run()).toEqual([{ name: TestName.Planned, status: TestStatus.Todo }]);
  });

  it('a variant runs its body the declared number of runs', async () => {
    const runner = new FakeRunner();
    let executed = 0;
    JestBindingHarness.variants(runner).it.only(
      TestName.Focused,
      { runs: RunCount.Smaller },
      async () => {
        executed += 1;
      },
    );
    await runner.run();
    expect(executed).toBe(RunCount.Smaller);
  });

  it('a variant without options runs the configured run count', async () => {
    const runner = new FakeRunner();
    let executed = 0;
    JestBindingHarness.variants(runner, new RunScope(), ProjectDefaults.strictGate).it.only(
      TestName.Focused,
      async () => {
        executed += 1;
      },
    );
    await runner.run();
    expect(executed).toBe(RunCount.Gated);
  });

  it('a variant body receives its run context t', async () => {
    const runner = new FakeRunner();
    JestBindingHarness.variants(runner).it.only(
      TestName.Focused,
      GateHarness.smoke,
      async (t: RunAssertions) => {
        t.facts(StateFact.Casino);
        await GateHarness.requireSeen(t);
      },
    );
    expect(await runner.run()).toEqual([{ name: TestName.Focused, status: TestStatus.Passed }]);
  });

  it('a trailing timeout on a variant gives the runner the test timeout plus the margin', () => {
    const runner = new FakeRunner();
    JestBindingHarness.variants(runner).it.only(
      TestName.Focused,
      async () => {},
      CustomTimeout.Long,
    );
    expect(runner.timeoutOf(TestName.Focused)).toBe(
      CustomTimeout.Long + TimeoutBudget.CeilingMarginMs,
    );
  });

  it('a failing run count on a variant fails the test', async () => {
    const runner = new FakeRunner();
    JestBindingHarness.variants(runner).it.only(TestName.Focused, GateHarness.smoke, async () => {
      throw new Error('the run misses');
    });
    expect(await runner.run()).toEqual([{ name: TestName.Focused, status: TestStatus.Failed }]);
  });

  it.each<[string, unknown[]]>([
    ['options without a body', [TestName.Focused, GateHarness.smoke]],
    ['invalid options', [TestName.Focused, { runs: RunCount.Single - 1 }, async () => {}]],
    ['two bodies', [TestName.Focused, async () => {}, async () => {}]],
    [
      'an argument after the timeout',
      [TestName.Focused, async () => {}, CustomTimeout.Short, CustomTimeout.Long],
    ],
  ])('it.only rejects %s as usage and registers nothing', (_label, args) => {
    const runner = new FakeRunner();
    const { it: test } = JestBindingHarness.variants(runner);
    expect(JestBindingHarness.errorFrom(() => test.only(...args)).kind).toBe('usage');
    expect(runner.names()).toHaveLength(0);
  });

  it('works through call, like the runner function it wraps', async () => {
    const runner = new FakeRunner();
    let executed = 0;
    JestBindingHarness.variants(runner).it.call(
      undefined,
      TestName.Plain,
      GateHarness.smoke,
      () => {
        executed += 1;
      },
    );
    await runner.run();
    expect(executed).toBe(RunCount.Single);
  });
});

describe('crucible.it.each', () => {
  it('registers one gated test per array row with the runner’s name formatting', async () => {
    const runner = new FakeRunner();
    JestBindingHarness.variants(runner).it.each([[RowValue.Apples], [RowValue.Pears]])(
      TestName.Row,
      GateHarness.smoke,
      async () => {},
    );
    expect(await runner.run()).toEqual([
      { name: `counts ${RowValue.Apples}`, status: TestStatus.Passed },
      { name: `counts ${RowValue.Pears}`, status: TestStatus.Passed },
    ]);
  });

  it('passes array row values to the body after t', async () => {
    const runner = new FakeRunner();
    const received: unknown[][] = [];
    JestBindingHarness.variants(runner).it.each([[RowValue.Apples, RunCount.Smaller]])(
      TestName.Row,
      GateHarness.smoke,
      async (_t: RunAssertions, ...row: unknown[]) => {
        received.push(row);
      },
    );
    await runner.run();
    expect(received).toEqual([[RowValue.Apples, RunCount.Smaller]]);
  });

  it('passes an object row to the body after t', async () => {
    const runner = new FakeRunner();
    const received: unknown[][] = [];
    JestBindingHarness.variants(runner).it.each([{ fruit: RowValue.Pears }])(
      TestName.ObjectRow,
      GateHarness.smoke,
      async (_t: RunAssertions, ...row: unknown[]) => {
        received.push(row);
      },
    );
    expect(runner.names()).toEqual([`counts ${RowValue.Pears}`]);
    await runner.run();
    expect(received).toEqual([[{ fruit: RowValue.Pears }]]);
  });

  it('runs each row the declared number of runs', async () => {
    const runner = new FakeRunner();
    let executed = 0;
    JestBindingHarness.variants(runner).it.each([[RowValue.Apples], [RowValue.Pears]])(
      TestName.Row,
      { runs: RunCount.Smaller },
      async () => {
        executed += 1;
      },
    );
    await runner.run();
    expect(executed).toBe(RunCount.Smaller * 2);
  });

  it('gives each row the runner timeout for its trailing timeout', () => {
    const runner = new FakeRunner();
    JestBindingHarness.variants(runner).it.each([[RowValue.Apples]])(
      TestName.Row,
      async () => {},
      CustomTimeout.Long,
    );
    expect(runner.timeoutOf(`counts ${RowValue.Apples}`)).toBe(
      CustomTimeout.Long + TimeoutBudget.CeilingMarginMs,
    );
  });

  it('it.only.each focuses its rows', async () => {
    const runner = new FakeRunner();
    const { it: test } = JestBindingHarness.variants(runner);
    test(TestName.Plain, GateHarness.smoke, async () => {});
    test.only.each([[RowValue.Apples]])(TestName.Row, GateHarness.smoke, async () => {});
    expect(await runner.run()).toEqual([
      { name: TestName.Plain, status: TestStatus.Skipped },
      { name: `counts ${RowValue.Apples}`, status: TestStatus.Passed },
    ]);
  });

  it('it.skip.each never runs its rows', async () => {
    const runner = new FakeRunner();
    let executed = 0;
    JestBindingHarness.variants(runner).it.skip.each([[RowValue.Apples], [RowValue.Pears]])(
      TestName.Row,
      async () => {
        executed += 1;
      },
    );
    await runner.run();
    expect(executed).toBe(0);
  });

  it('rejects invalid options on a row registrar as usage and registers nothing', () => {
    const runner = new FakeRunner();
    const rows = JestBindingHarness.variants(runner).it.each([[RowValue.Apples]]);
    const error = JestBindingHarness.errorFrom(() =>
      rows(TestName.Row, { runs: RunCount.Single - 1 }, async () => {}),
    );
    expect(error.kind).toBe('usage');
    expect(runner.names()).toHaveLength(0);
  });
});

describe('crucible.describe variants', () => {
  it('describe.each repeats the group per row and forwards the row values', async () => {
    const runner = new FakeRunner();
    const { it: test, describe: group } = JestBindingHarness.variants(runner);
    const seen: unknown[] = [];
    group.each([[RowValue.Apples], [RowValue.Pears]])(TestName.Group, (fruit: unknown) => {
      test(TestName.Inside, GateHarness.smoke, async () => {
        seen.push(fruit);
      });
    });
    expect(await runner.run()).toEqual([
      { name: `group ${RowValue.Apples} > inside`, status: TestStatus.Passed },
      { name: `group ${RowValue.Pears} > inside`, status: TestStatus.Passed },
    ]);
    expect(seen).toEqual([RowValue.Apples, RowValue.Pears]);
  });

  it('tests inside describe.each inherit the group options', async () => {
    const runner = new FakeRunner();
    const { it: test, describe: group } = JestBindingHarness.variants(runner);
    let executed = 0;
    group.each([{ fruit: RowValue.Apples }])(TestName.Group, { runs: RunCount.Smaller }, () => {
      test(TestName.Inside, async () => {
        executed += 1;
      });
    });
    await runner.run();
    expect(executed).toBe(RunCount.Smaller);
  });

  it('describe.only focuses its tests and they inherit its options', async () => {
    const runner = new FakeRunner();
    const { it: test, describe: group } = JestBindingHarness.variants(runner);
    let executed = 0;
    test(TestName.Plain, GateHarness.smoke, async () => {});
    group.only(TestName.Focused, { runs: RunCount.Smaller }, () => {
      test(TestName.Inside, async () => {
        executed += 1;
      });
    });
    expect(await runner.run()).toEqual([
      { name: TestName.Plain, status: TestStatus.Skipped },
      { name: `${TestName.Focused} > ${TestName.Inside}`, status: TestStatus.Passed },
    ]);
    expect(executed).toBe(RunCount.Smaller);
  });

  it('describe.skip never runs the tests inside it', async () => {
    const runner = new FakeRunner();
    const { it: test, describe: group } = JestBindingHarness.variants(runner);
    let executed = 0;
    group.skip(TestName.Skipped, () => {
      test(TestName.Inside, async () => {
        executed += 1;
      });
    });
    await runner.run();
    expect(executed).toBe(0);
  });

  it('describe.only.each focuses its rows and their tests inherit the group options', async () => {
    const runner = new FakeRunner();
    const { it: test, describe: group } = JestBindingHarness.variants(runner);
    let executed = 0;
    test(TestName.Plain, GateHarness.smoke, async () => {});
    group.only.each([[RowValue.Apples]])(TestName.Group, { runs: RunCount.Smaller }, () => {
      test(TestName.Inside, async () => {
        executed += 1;
      });
    });
    expect(await runner.run()).toEqual([
      { name: TestName.Plain, status: TestStatus.Skipped },
      { name: `group ${RowValue.Apples} > inside`, status: TestStatus.Passed },
    ]);
    expect(executed).toBe(RunCount.Smaller);
  });

  it('describe.skip.each never runs its rows', async () => {
    const runner = new FakeRunner();
    const { it: test, describe: group } = JestBindingHarness.variants(runner);
    let executed = 0;
    group.skip.each([[RowValue.Apples]])(TestName.Group, () => {
      test(TestName.Inside, async () => {
        executed += 1;
      });
    });
    await runner.run();
    expect(executed).toBe(0);
  });

  it('rejects an argument after a describe.each callback as usage', () => {
    const runner = new FakeRunner();
    const rows = JestBindingHarness.variants(runner).describe.each([[RowValue.Apples]]);
    const error = JestBindingHarness.errorFrom(() =>
      rows(TestName.Group, () => {}, CustomTimeout.Short),
    );
    expect(error.kind).toBe('usage');
    expect(runner.names()).toHaveLength(0);
  });
});

describe('blocked and unknown variants', () => {
  it.each<[string, (variants: WrappedRunner) => unknown]>([
    ['it.failing', (v) => v.it[RunnerProperty.Failing]],
    ['it.concurrent', (v) => v.it[RunnerProperty.Concurrent]],
    ['it.only.failing', (v) => v.it.only[RunnerProperty.Failing]],
    ['a runner variant Crucible does not wrap', (v) => v.it[RunnerProperty.Unsupported]],
    ['it.each.only', (v) => v.it.each.only],
    ['it.todo.each', (v) => v.it.todo.each],
    ['describe.todo', (v) => v.describe.todo],
  ])('%s is a usage error on access', (_label, access) => {
    const variants = JestBindingHarness.variants(new FakeRunner());
    expect(JestBindingHarness.errorFrom(() => access(variants)).kind).toBe('usage');
  });

  it.each<[string, (variants: WrappedRunner) => unknown]>([
    ['then on crucible.it', (v) => v.it[RunnerProperty.Then]],
    ['then on crucible.describe.only', (v) => v.describe.only[RunnerProperty.Then]],
    ['toJSON', (v) => v.it[RunnerProperty.ToJson]],
    ['asymmetricMatch', (v) => v.it.each[RunnerProperty.AsymmetricMatch]],
    ['prototype', (v) => v.it[RunnerProperty.Prototype]],
    ['a property the runner does not have either', (v) => v.describe[RunnerProperty.Unknown]],
    ['Symbol.toStringTag', (v) => v.it[Symbol.toStringTag as unknown as string]],
  ])('%s is undefined, as on the runner', (_label, access) => {
    expect(access(JestBindingHarness.variants(new FakeRunner()))).toBeUndefined();
  });

  it('reports its supported variants, and only those, to the in operator', () => {
    const { it: test } = JestBindingHarness.variants(new FakeRunner());
    expect([RunnerProperty.Only in test, RunnerProperty.Failing in test]).toEqual([true, false]);
  });

  it('awaiting a variant resolves to the variant itself', async () => {
    const { it: test } = JestBindingHarness.variants(new FakeRunner());
    expect(await Promise.resolve(test.only)).toBe(test.only);
  });

  it('serialises and inspects without a usage error, showing its path', () => {
    const { it: test } = JestBindingHarness.variants(new FakeRunner());
    expect(JSON.stringify({ test })).toBe('{}');
    expect(inspect(test.only)).toContain(VariantPath.ItOnly);
  });

  it('property probes do not need the runner to be present', () => {
    const variants = JestBindingHarness.wrapOver({});
    expect(variants.it[RunnerProperty.Then]).toBeUndefined();
  });

  it('cannot be reassigned', () => {
    const { it: test } = JestBindingHarness.variants(new FakeRunner());
    expect(Capture.thrown(() => Object.assign(test, { only: test }))).toBeInstanceOf(TypeError);
  });
});

describe('runner lookup', () => {
  it('a missing runner function is a usage error when the variant is called', () => {
    const variants = JestBindingHarness.wrapOver({ it: () => {}, describe: () => {} });
    const error = Capture.thrown(() => variants.it.only(TestName.Focused, async () => {}));
    expect(error).toBeInstanceOf(CrucibleError);
    expect((error as CrucibleError).kind).toBe('usage');
  });

  it('a missing global it is a usage error when a test is declared', () => {
    const variants = JestBindingHarness.wrapOver({});
    const error = Capture.thrown(() => variants.it(TestName.Plain, async () => {}));
    expect((error as CrucibleError).kind).toBe('usage');
  });

  it('a missing global describe is a usage error when a group is declared', () => {
    const variants = JestBindingHarness.wrapOver({});
    const error = Capture.thrown(() => variants.describe(TestName.Group, () => {}));
    expect((error as CrucibleError).kind).toBe('usage');
  });
});
