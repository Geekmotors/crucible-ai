import { expect } from '@jest/globals';
import { CrucibleError } from '../../core/errors.js';
import type { Runner } from '../../core/runner.js';
import type { RunOptions } from '../../core/run-options.js';
import { RunScope } from '../../core/state.js';
import { Capture } from '../../core/test/capture.util.js';
import { ManualTimer } from '../../core/test/manual-timer.fake.js';
import { RunnerHarness } from '../../core/test/runner-harness.util.js';
import { TimeBudget } from '../../core/time-budget.util.js';
import { JestBinding } from '../jest.js';
import { DescribeRegistrarFake } from './describe-registrar.fake.js';
import { RegistrarFake } from './registrar.fake.js';

class JestBindingHarness {
  static binding(
    registrar: RegistrarFake,
    scope: RunScope = new RunScope(),
    defaults: RunOptions = {},
    timer: ManualTimer = new ManualTimer(),
    describes: DescribeRegistrarFake = new DescribeRegistrarFake(),
  ): JestBinding {
    return JestBindingHarness.over(
      RunnerHarness.runner(scope, timer, defaults),
      registrar,
      describes,
    );
  }

  static registeredTimeout(
    declare: (binding: JestBinding) => void,
    defaults: RunOptions = {},
  ): number | undefined {
    const registrar = new RegistrarFake();
    declare(JestBindingHarness.binding(registrar, new RunScope(), defaults));
    return registrar.registrations[0]?.timeout;
  }

  static over(
    runner: Runner,
    registrar: RegistrarFake,
    describes: DescribeRegistrarFake = new DescribeRegistrarFake(),
  ): JestBinding {
    return new JestBinding(runner, registrar.register, describes.register);
  }

  static runnerBudget(runs: number): number {
    return TimeBudget.testTimeoutFor(runs);
  }

  static errorFrom(fn: () => unknown): CrucibleError {
    const error = Capture.thrown(fn);
    expect(error).toBeInstanceOf(CrucibleError);
    return error as CrucibleError;
  }
}

export { JestBindingHarness };
