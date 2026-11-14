import { VitestRunnerFake } from './vitest-runner.fake.js';

class UnlinkedSuiteRunnerFake extends VitestRunnerFake {
  override source = {
    test: this.test,
    describe: this.describe,
    currentGroup: (): unknown => ({}),
  };
}

export { UnlinkedSuiteRunnerFake };
