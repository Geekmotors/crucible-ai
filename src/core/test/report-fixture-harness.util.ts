import { Aggregator } from '../aggregator.util.js';
import { Reporter } from '../reporter.util.js';
import type { ReportSettings } from '../report-settings.js';
import type { RunGate } from '../run-options.js';
import type { RunResult } from '../run-result.js';
import { FixtureOutcome } from './fixture-outcome.util.js';
import type { ObservedOutcome } from './fixture-outcome.util.js';
import { NeutralRun } from './neutral-run.util.js';
import type { NeutralRunRecord } from './neutral-run.util.js';

type Ending =
  | { kind: 'verdict' }
  | { kind: 'aborted'; fatalRun: number }
  | { kind: 'expired'; deadlineMs: number };

type RenderInput = RunGate & {
  settings: ReportSettings;
  ending: Ending;
  results: NeutralRunRecord[];
};

class ReportFixtureHarness {
  static render(input: unknown): Promise<ObservedOutcome> {
    const { settings, runs, threshold, ending, results: records } = input as RenderInput;
    const reporter = new Reporter(() => settings);
    const results = records.map((record) => NeutralRun.result(record));
    return FixtureOutcome.rendered(() =>
      ReportFixtureHarness.rendered(reporter, results, { runs, threshold }, ending),
    );
  }

  private static rendered(
    reporter: Reporter,
    results: RunResult[],
    options: RunGate,
    ending: Ending,
  ): string {
    if (ending.kind === 'aborted') {
      return reporter.renderAborted({
        results,
        options,
        fatal: results[ending.fatalRun - 1]?.cause,
      });
    }
    if (ending.kind === 'expired') {
      return reporter.renderExpired({ results, options, deadlineMs: ending.deadlineMs });
    }
    const tally = new Aggregator().tally(
      results.map((result) => result.status),
      options,
    );
    const summary = { results, tally, options };
    return tally.zone === 'pass' ? reporter.renderPassed(summary) : reporter.renderVerdict(summary);
  }
}

export { ReportFixtureHarness };
