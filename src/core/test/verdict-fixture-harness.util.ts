import { Aggregator } from '../aggregator.util.js';
import type { RunStatus, VerdictZone } from '../run-result.js';
import type { VerdictOutcome } from '../verdict-error.js';
import { FixtureOutcome } from './fixture-outcome.util.js';
import type { ObservedOutcome } from './fixture-outcome.util.js';
import { SpecialValue } from './special-value.util.js';

type VerdictInput = { threshold: number; statuses: Partial<Record<RunStatus, number>> };

class VerdictFixtureHarness {
  private static outcomes: Record<VerdictZone, VerdictOutcome | 'passed'> = {
    pass: 'passed',
    fail: 'failed',
    errored: 'errored',
  };

  static compute(input: unknown): Promise<ObservedOutcome> {
    const { threshold, statuses } = SpecialValue.decode(input) as VerdictInput;
    const runs = Object.entries(statuses).flatMap(([status, count]) =>
      Array<RunStatus>(count).fill(status as RunStatus),
    );
    return FixtureOutcome.settled(() => {
      const { zone, ...counts } = new Aggregator().tally(runs, { runs: runs.length, threshold });
      return { outcome: VerdictFixtureHarness.outcomes[zone], ...counts };
    });
  }
}

export { VerdictFixtureHarness };
