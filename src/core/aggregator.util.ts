import type { ResolvedRunOptions } from './run-options.js';
import type { RunStatus, RunTally, VerdictZone } from './run-result.js';

class Aggregator {
  private static readonly NEED_EPSILON = 1e-9;
  private static readonly MIN_NEED = 1;

  tally(statuses: readonly RunStatus[], opts: ResolvedRunOptions): RunTally {
    const need = Math.max(
      Aggregator.MIN_NEED,
      Math.ceil(opts.threshold * opts.runs - Aggregator.NEED_EPSILON),
    );
    const passed = this.count(statuses, 'passed');
    const failed = this.count(statuses, 'failed');
    const errored = this.count(statuses, 'errored');
    return { zone: this.zone(need, passed, errored), need, passed, failed, errored };
  }

  private zone(need: number, passed: number, errored: number): VerdictZone {
    if (passed >= need) {
      return 'pass';
    }
    if (passed + errored < need) {
      return 'fail';
    }
    return 'errored';
  }

  private count(statuses: readonly RunStatus[], status: RunStatus): number {
    return statuses.filter((candidate) => candidate === status).length;
  }
}

export { Aggregator };
