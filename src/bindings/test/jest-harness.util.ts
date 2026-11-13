import { expect } from '@jest/globals';
import { CrucibleError } from '../../core/errors.js';
import type { Runner } from '../../core/runner.js';
import type { RunOptions } from '../../core/run-options.js';
import { RunScope } from '../../core/state.js';
import { Capture } from '../../core/test/capture.util.js';
import { ManualTimer } from '../../core/test/manual-timer.fake.js';
import { RunnerHarness } from '../../core/test/runner-harness.util.js';
import { JestBinding } from '../jest.js';
import { RegistrarFake } from './registrar.fake.js';

class JestBindingHarness {
  static binding(
    registrar: RegistrarFake,
    scope: RunScope = new RunScope(),
    defaults: RunOptions = {},
  ): JestBinding {
    return JestBindingHarness.over(
      RunnerHarness.runner(scope, new ManualTimer(), defaults),
      registrar,
    );
  }

  static over(runner: Runner, registrar: RegistrarFake): JestBinding {
    return new JestBinding(runner, registrar.register);
  }

  static runnerBudget(runs: number): number {
    return RunnerHarness.runner().timeoutFor(runs);
  }

  static errorFrom(fn: () => unknown): CrucibleError {
    const error = Capture.thrown(fn);
    expect(error).toBeInstanceOf(CrucibleError);
    return error as CrucibleError;
  }
}

export { JestBindingHarness };
