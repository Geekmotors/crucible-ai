import { Measurer } from '../measurer.util.js';
import type { ClaimVerdict } from '../measurer.util.js';
import type { RunStatus } from '../run-result.js';
import { FixtureOutcome } from './fixture-outcome.util.js';
import type { ObservedOutcome } from './fixture-outcome.util.js';

type MeasureInput = {
  threshold: number;
  gateRuns: number;
  statuses: Partial<Record<RunStatus, number>>;
};

type ByAssertionInput = {
  results: { status: RunStatus; verdicts?: ClaimVerdict[] }[];
};

class MeasureFixtureHarness {
  static measure(input: unknown): Promise<ObservedOutcome> {
    const { threshold, gateRuns, statuses } = input as MeasureInput;
    const runs = Object.entries(statuses).flatMap(([status, count]) =>
      Array<RunStatus>(count).fill(status as RunStatus),
    );
    return FixtureOutcome.settled(() => new Measurer().measure(runs, threshold, gateRuns));
  }

  static byAssertion(input: unknown): Promise<ObservedOutcome> {
    const { results } = input as ByAssertionInput;
    return FixtureOutcome.settled(() =>
      new Measurer().byAssertion(
        results.map(({ status, verdicts = [] }) => ({ status, verdicts })),
      ),
    );
  }
}

export { MeasureFixtureHarness };
