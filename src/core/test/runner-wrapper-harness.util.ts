import { expect } from '@jest/globals';
import { CrucibleError } from '../errors.js';
import { Gate } from '../gate.js';
import type { RunOptions } from '../run-options.js';
import { RunnerWrapper } from '../runner-wrapper.js';
import { ScopedAssertions } from '../scoped-assertions.js';
import { RunScope } from '../state.js';
import { Capture } from './capture.util.js';
import { ExtractorHarness } from './extractor-harness.util.js';
import { JudgeHarness } from './judge-harness.util.js';
import { ManualTimer } from './manual-timer.fake.js';
import type { NeutralRunnerFake } from './neutral-runner.fake.js';
import { RunnerHarness } from './runner-harness.util.js';
import { StateFact } from './state-fact.enum.js';

type Wrapped = {
  (...args: unknown[]): Wrapped;
  [key: string]: Wrapped;
};
type WrappedFamilies = { it: Wrapped; describe: Wrapped };

class RunnerWrapperHarness {
  static wrap(
    runner: NeutralRunnerFake,
    present = true,
    defaults: RunOptions = {},
  ): WrappedFamilies {
    const scope = new RunScope();
    const assertions = new ScopedAssertions(
      scope,
      () => JudgeHarness.factJudge(scope, [StateFact.Casino]),
      () => ExtractorHarness.factExtractor(scope, [StateFact.Casino]),
    );
    const wrapper = new RunnerWrapper(
      new Gate(RunnerHarness.runner(scope, new ManualTimer(), defaults), assertions),
      runner.spec(present),
    );
    return { it: wrapper.test() as Wrapped, describe: wrapper.group() as Wrapped };
  }

  static errorFrom(fn: () => unknown): CrucibleError {
    const error = Capture.thrown(fn);
    expect(error).toBeInstanceOf(CrucibleError);
    return error as CrucibleError;
  }
}

export { RunnerWrapperHarness };
export type { Wrapped, WrappedFamilies };
