import { Aggregator } from '../aggregator.util.js';
import { Reporter } from '../reporter.util.js';
import { DEFAULT_REPORT_SETTINGS } from '../report-settings.js';
import type { RunResult, RunStatus } from '../run-result.js';
import type { Verbosity } from '../verbosity.js';
import type { ErrorRecord, ExtractionRecord, RunLedger, VerdictRecord } from '../state.js';
import { AssertionName } from './assertion-name.enum.js';
import { ClaimText } from './claim-text.enum.js';
import { ExtractTarget } from './extract-target.enum.js';
import { ProviderFault } from './provider-fault.enum.js';
import { Threshold } from './threshold.enum.js';

class ReportHarness {
  static trueVerdict(): VerdictRecord {
    return ReportHarness.verdict(ClaimText.Default, true, 0);
  }

  static verdict(claim: string, verdict: boolean, seq: number): VerdictRecord {
    return {
      assertion: AssertionName.Coherent,
      claim,
      verdict,
      reasoning: 'the reasoning',
      response: 'the response',
      facts: [],
      seq,
    };
  }

  static extraction(description: ExtractTarget, seq: number): ExtractionRecord {
    return {
      assertion: AssertionName.Extract,
      description,
      type: 'string',
      mode: 'lenient',
      value: null,
      reasoning: 'the reasoning',
      response: 'the response',
      facts: [],
      seq,
    };
  }

  static judgeError(attempts: number, seq: number): ErrorRecord {
    return { cause: new Error(ProviderFault.InvalidKey), attempts, seq };
  }

  static reporter(
    excerptChars: number = DEFAULT_REPORT_SETTINGS.excerptChars,
    verbosity: Verbosity = DEFAULT_REPORT_SETTINGS.verbosity,
  ): Reporter {
    return new Reporter(() => ({ excerptChars, verbosity }));
  }

  static run(status: RunStatus, cause?: unknown): RunResult {
    return { status, cause, context: { state: [], verdicts: [], extractions: [], errors: [] } };
  }

  static renderedFailure(cause: unknown): string {
    return ReportHarness.rendered(ReportHarness.run('failed', cause));
  }

  static renderedLedger(
    status: RunStatus,
    ledger: Partial<RunLedger>,
    verbosity: Verbosity = DEFAULT_REPORT_SETTINGS.verbosity,
  ): string {
    const result = {
      ...ReportHarness.run(status, new Error(ClaimText.Default)),
      context: { state: [], verdicts: [], extractions: [], errors: [], ...ledger },
    };
    return ReportHarness.rendered(result, verbosity);
  }

  private static rendered(
    result: RunResult,
    verbosity: Verbosity = DEFAULT_REPORT_SETTINGS.verbosity,
  ): string {
    const results = [result];
    const options = { runs: results.length, threshold: Threshold.Certain };
    const tally = new Aggregator().tally(
      results.map(({ status }) => status),
      options,
    );
    return ReportHarness.reporter(DEFAULT_REPORT_SETTINGS.excerptChars, verbosity).renderVerdict({
      results,
      tally,
      options,
    });
  }
}

export { ReportHarness };
