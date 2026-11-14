import { expect } from '@jest/globals';
import { CrucibleError } from '../../core/errors.js';
import { Gate } from '../../core/gate.js';
import { GroupSettings } from '../../core/group-settings.js';
import type { RunOptions } from '../../core/run-options.js';
import { RunnerWrapper } from '../../core/runner-wrapper.js';
import { RunScope } from '../../core/state.js';
import { Capture } from '../../core/test/capture.util.js';
import { ManualTimer } from '../../core/test/manual-timer.fake.js';
import { RunnerHarness } from '../../core/test/runner-harness.util.js';
import { VitestBinding } from '../vitest.js';
import type { VitestSource } from '../vitest.js';
import { JestBindingHarness } from './jest-harness.util.js';
import type { WrappedRunner } from './jest-harness.util.js';
import type { VitestRunnerFake } from './vitest-runner.fake.js';

class VitestBindingHarness {
  static variants(
    runner: VitestRunnerFake,
    scope: RunScope = new RunScope(),
    defaults: RunOptions = {},
  ): WrappedRunner {
    return VitestBindingHarness.over(runner.source, scope, defaults);
  }

  static over(
    source: VitestSource,
    scope: RunScope = new RunScope(),
    defaults: RunOptions = {},
  ): WrappedRunner {
    const spec = new VitestBinding(source).spec();
    const wrapper = new RunnerWrapper(
      new Gate(
        RunnerHarness.runner(scope, new ManualTimer(), defaults),
        JestBindingHarness.assertions(scope),
        new GroupSettings(spec.groupPath),
      ),
      spec,
    );
    return { it: wrapper.test(), describe: wrapper.group() } as WrappedRunner;
  }

  static errorFrom(fn: () => unknown): CrucibleError {
    const error = Capture.thrown(fn);
    expect(error).toBeInstanceOf(CrucibleError);
    return error as CrucibleError;
  }
}

export { VitestBindingHarness };
