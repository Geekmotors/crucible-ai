import { describe, expect, it } from '@jest/globals';
import { Runner } from '../core/runner.js';
import type { RunOptions } from '../core/run-options.js';
import { RunScope } from '../core/state.js';
import { Capture } from '../core/test/capture.util.js';
import { RunCount } from '../core/test/run-count.enum.js';
import { Threshold } from '../core/test/threshold.enum.js';
import { TimeoutBudget } from '../core/test/timeout-budget.enum.js';
import { CrucibleVerdictError } from '../core/verdict-error.js';
import { JestBinding } from './jest.js';
import { JestBindingHarness } from './test/jest-harness.util.js';
import { RegistrarFake } from './test/registrar.fake.js';

describe('JestBinding', () => {
  it('registers exactly one test per declaration, with the 30 second smoke budget', () => {
    const registrar = new RegistrarFake();
    JestBindingHarness.binding(registrar).register('checks coherence', async () => {});
    expect(registrar.registrations).toHaveLength(1);
    expect(registrar.registrations[0]?.name).toBe('checks coherence');
    expect(registrar.registrations[0]?.timeout).toBe(TimeoutBudget.SmokeMs);
  });

  it('registers with the runner budget for the declared run count', () => {
    const registrar = new RegistrarFake();
    JestBindingHarness.binding(registrar).register(
      'gated',
      { runs: RunCount.Gated, threshold: Threshold.Strict },
      async () => {},
    );
    expect(registrar.registrations[0]?.timeout).toBe(
      new Runner(new RunScope()).timeoutFor(RunCount.Gated),
    );
  });

  it('inert registration — body must not run until the framework invokes the test', () => {
    const registrar = new RegistrarFake();
    let ran = false;
    JestBindingHarness.binding(registrar).register('inert', async () => {
      ran = true;
    });
    expect(ran).toBe(false);
  });

  it('body runs once inside a run scope — smoke mode is a single run', async () => {
    const registrar = new RegistrarFake();
    const scope = new RunScope();
    let runs = 0;
    JestBindingHarness.binding(registrar, scope).register('smoke', async () => {
      runs += 1;
    });
    await registrar.registrations[0]?.fn();
    expect(runs).toBe(1);
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
    [{ threshold: 0 }],
    [{ threshold: RunCount.Gated }],
    [{ threshold: Number.NaN }],
    [{ runs: 0 }],
    [{ runs: Threshold.Half }],
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
