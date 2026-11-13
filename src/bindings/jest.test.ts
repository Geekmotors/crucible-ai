import { describe, expect, it } from '@jest/globals';
import { CrucibleError } from '../core/errors.js';
import type { RunOptions } from '../core/run-options.js';
import { RunScope } from '../core/state.js';
import { Capture } from '../core/test/capture.util.js';
import { ProjectDefaults } from '../core/test/project-defaults.util.js';
import { RunCount } from '../core/test/run-count.enum.js';
import { RunnerHarness } from '../core/test/runner-harness.util.js';
import { Threshold } from '../core/test/threshold.enum.js';
import { TimeoutBudget } from '../core/test/timeout-budget.enum.js';
import { CrucibleVerdictError } from '../core/verdict-error.js';
import { CustomTimeout } from '../core/test/custom-timeout.enum.js';
import { InvalidTimeout } from '../core/test/invalid-timeout.enum.js';
import { ManualTimer } from '../core/test/manual-timer.fake.js';
import { JestBinding } from './jest.js';
import { InvalidOption } from './test/invalid-option.enum.js';
import { JestBindingHarness } from './test/jest-harness.util.js';
import { RegistrarFake } from './test/registrar.fake.js';

describe('JestBinding', () => {
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
        { run: 5 } as unknown as Parameters<JestBinding['register']>[1],
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
  it.each<[string, (binding: JestBinding) => void]>([
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

  it.each<[string, (binding: JestBinding, body: () => Promise<void>) => void]>([
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
