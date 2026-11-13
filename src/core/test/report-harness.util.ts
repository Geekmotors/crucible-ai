import { Aggregator } from '../aggregator.util.js';
import { Reporter } from '../reporter.util.js';
import type { ResolvedRunOptions } from '../run-options.js';
import type { RunResult, RunStatus } from '../run-result.js';
import type { ErrorRecord, RunContext, VerdictRecord } from '../state.js';

class ReportHarness {
  static context(verdicts: VerdictRecord[] = [], errors: ErrorRecord[] = []): RunContext {
    return { state: [], verdicts, errors };
  }

  static falseVerdict(overrides: Partial<VerdictRecord> = {}): VerdictRecord {
    return {
      assertion: 'coherent',
      claim: 'the claim',
      verdict: false,
      reasoning: 'the reasoning',
      response: 'the response',
      seq: 0,
      ...overrides,
    };
  }

  static renderedFailure(
    verdicts: VerdictRecord[],
    cause: unknown = new Error('boom'),
    errors: ErrorRecord[] = [],
  ): string {
    return new Reporter().renderFailed(ReportHarness.context(verdicts, errors), cause);
  }

  static run(status: RunStatus, cause?: unknown, verdicts: VerdictRecord[] = []): RunResult {
    return { status, cause, context: ReportHarness.context(verdicts) };
  }

  static renderedAbort(results: RunResult[], threshold: number): string {
    return new Reporter().renderAborted({ results, options: { runs: results.length, threshold } });
  }

  static renderedVerdict(results: RunResult[], threshold: number): string {
    const options: ResolvedRunOptions = { runs: results.length, threshold };
    const tally = new Aggregator().tally(
      results.map((result) => result.status),
      options,
    );
    return new Reporter().renderVerdict({ results, tally, options });
  }
}

export { ReportHarness };
