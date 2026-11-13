import { Aggregator } from '../aggregator.util.js';
import { Reporter } from '../reporter.util.js';
import { DEFAULT_REPORT_SETTINGS } from '../report-settings.js';
import type { ResolvedRunOptions } from '../run-options.js';
import type { RunResult, RunStatus } from '../run-result.js';
import type { ErrorRecord, RunContext, VerdictRecord } from '../state.js';
import { AssertionName } from './assertion-name.enum.js';
import { Threshold } from './threshold.enum.js';

class ReportHarness {
  static context(verdicts: VerdictRecord[] = [], errors: ErrorRecord[] = []): RunContext {
    return { state: [], verdicts, errors };
  }

  static falseVerdict(overrides: Partial<VerdictRecord> = {}): VerdictRecord {
    return {
      assertion: AssertionName.Coherent,
      claim: 'the claim',
      verdict: false,
      reasoning: 'the reasoning',
      response: 'the response',
      seq: 0,
      ...overrides,
    };
  }

  static reporter(excerptChars: number = DEFAULT_REPORT_SETTINGS.excerptChars): Reporter {
    return new Reporter(() => ({ excerptChars }));
  }

  static renderedFailure(
    verdicts: VerdictRecord[],
    cause: unknown = new Error('boom'),
    errors: ErrorRecord[] = [],
    reporter: Reporter = ReportHarness.reporter(),
  ): string {
    return ReportHarness.renderedVerdict(
      [ReportHarness.run('failed', cause, verdicts, errors)],
      Threshold.Certain,
      reporter,
    );
  }

  static renderedErrored(cause: unknown, errors: ErrorRecord[] = []): string {
    return ReportHarness.renderedVerdict(
      [ReportHarness.run('errored', cause, [], errors)],
      Threshold.Certain,
    );
  }

  static run(
    status: RunStatus,
    cause?: unknown,
    verdicts: VerdictRecord[] = [],
    errors: ErrorRecord[] = [],
  ): RunResult {
    return { status, cause, context: ReportHarness.context(verdicts, errors) };
  }

  static runs(count: number, status: RunStatus, claim?: string): RunResult[] {
    const verdicts = claim === undefined ? [] : [ReportHarness.falseVerdict({ claim })];
    return Array.from({ length: count }, () =>
      ReportHarness.run(status, new Error(status), verdicts),
    );
  }

  static renderedAbort(results: RunResult[], threshold: number = Threshold.Certain): string {
    return ReportHarness.reporter().renderAborted({
      results,
      options: { runs: results.length, threshold },
    });
  }

  static renderedExpiry(results: RunResult[], deadlineMs: number): string {
    return ReportHarness.reporter().renderExpired({
      results,
      options: { runs: results.length, threshold: Threshold.Certain },
      deadlineMs,
    });
  }

  static renderedVerdict(
    results: RunResult[],
    threshold: number,
    reporter: Reporter = ReportHarness.reporter(),
  ): string {
    const options: ResolvedRunOptions = { runs: results.length, threshold };
    const tally = new Aggregator().tally(
      results.map((result) => result.status),
      options,
    );
    return reporter.renderVerdict({ results, tally, options });
  }
}

export { ReportHarness };
