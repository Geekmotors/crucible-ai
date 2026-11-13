import type { RunStatus } from '../run-result.js';

class StatusMix {
  static of(passed: number, errored: number, failed: number): RunStatus[] {
    return [
      ...Array<RunStatus>(passed).fill('passed'),
      ...Array<RunStatus>(errored).fill('errored'),
      ...Array<RunStatus>(failed).fill('failed'),
    ];
  }
}

export { StatusMix };
