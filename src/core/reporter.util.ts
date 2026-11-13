import type { AbortSummary, ExpirySummary, RunResult, VerdictSummary } from './run-result.js';
import type { ErrorRecord, RunContext, VerdictRecord } from './state.js';

const RESPONSE_EXCERPT_LIMIT = 500;
const TRUNCATION_MARKER = '…';

type FirstFailure =
  { kind: 'verdict'; record: VerdictRecord } | { kind: 'error'; record: ErrorRecord } | undefined;

class Reporter {
  renderVerdict(summary: VerdictSummary): string {
    return [this.headline(summary), ...this.runSections(summary.results)].join('\n\n');
  }

  renderAborted(summary: AbortSummary): string {
    return [this.abortHeadline(summary), ...this.runSections(summary.results)].join('\n\n');
  }

  renderExpired(summary: ExpirySummary): string {
    return [this.expiryHeadline(summary), ...this.runSections(summary.results)].join('\n\n');
  }

  renderFailed(context: RunContext, cause: unknown): string {
    const first = this.firstFailure(context);
    if (first === undefined) {
      return `Run failed: ${this.describe(cause)}`;
    }
    if (first.kind === 'error') {
      return [
        'Run failed after a judge call errored.',
        `Judge error: ${this.describe(first.record.cause)}`,
        `Thrown: ${this.describe(cause)}`,
      ].join('\n');
    }
    return [
      'Coherence check failed.',
      `Claim: ${first.record.claim}`,
      `Judge reasoning: ${first.record.reasoning}`,
      `Response excerpt: ${this.excerpt(first.record.response)}`,
      `Thrown: ${this.describe(cause)}`,
    ].join('\n');
  }

  renderErrored(context: RunContext, cause: unknown): string {
    const lines = [
      'Run errored, not failed: an infrastructure problem prevented a verdict.',
      `Cause: ${this.describe(cause)}`,
    ];
    const attempts = this.lowestSeqError(context)?.attempts;
    if (attempts !== undefined) {
      lines.push(`Judge attempts: ${attempts}`);
    }
    return lines.join('\n');
  }

  private headline({ tally, options }: VerdictSummary): string {
    const rate = `${tally.passed}/${options.runs} runs passed against threshold ${options.threshold} (need ${tally.need})`;
    if (tally.zone === 'errored') {
      return `Verdict errored, not failed: ${rate}; ${tally.errored} errored run(s) left the result inconclusive.`;
    }
    return `Pass rate below threshold: ${rate}.`;
  }

  private abortHeadline({ results, options }: AbortSummary): string {
    const discarded = results.filter((result) => result.status === 'discarded').length;
    return `Test aborted on a fatal error after ${results.length - discarded}/${options.runs} runs settled; ${discarded} in-flight run(s) discarded to stop spend. Fix the provider setup (API key, model) or configuration and rerun.`;
  }

  private expiryHeadline({ results, options, deadlineMs }: ExpirySummary): string {
    const discarded = results.filter((result) => result.status === 'discarded').length;
    return `Test errored, not failed: it did not finish within its ${deadlineMs} ms deadline. ${results.length - discarded}/${options.runs} runs settled; ${discarded} in-flight run(s) discarded to stop spend. Check for a slow system under test or a throttled judge provider.`;
  }

  private runSections(results: readonly RunResult[]): string[] {
    const numbered = results.map((result, index) => ({ result, number: index + 1 }));
    const sections = numbered
      .filter(({ result }) => result.status === 'failed' || result.status === 'errored')
      .map(({ result, number }) => this.renderRunSection(result, number));
    const discarded = numbered
      .filter(({ result }) => result.status === 'discarded')
      .map(({ number }) => `Run #${number}`);
    if (discarded.length > 0) {
      sections.push(`Discarded (aborted in flight, counted in no zone): ${discarded.join(', ')}`);
    }
    return sections;
  }

  private renderRunSection(result: RunResult, number: number): string {
    const body =
      result.status === 'errored'
        ? this.renderErrored(result.context, result.cause)
        : this.renderFailed(result.context, result.cause);
    return `--- Run #${number} (${result.status}) ---\n${body}`;
  }

  private firstFailure(context: RunContext): FirstFailure {
    const verdict = context.verdicts
      .filter((record) => record.verdict === false)
      .reduce<VerdictRecord | undefined>(
        (lowest, record) => (lowest === undefined || record.seq < lowest.seq ? record : lowest),
        undefined,
      );
    const error = this.lowestSeqError(context);
    if (verdict === undefined && error === undefined) {
      return undefined;
    }
    if (error === undefined || (verdict !== undefined && verdict.seq < error.seq)) {
      return { kind: 'verdict', record: verdict as VerdictRecord };
    }
    return { kind: 'error', record: error };
  }

  private lowestSeqError(context: RunContext): ErrorRecord | undefined {
    return context.errors.reduce<ErrorRecord | undefined>(
      (lowest, record) => (lowest === undefined || record.seq < lowest.seq ? record : lowest),
      undefined,
    );
  }

  private excerpt(response: string): string {
    if (response.length <= RESPONSE_EXCERPT_LIMIT) {
      return response;
    }
    const cut = response.slice(0, RESPONSE_EXCERPT_LIMIT).replace(/[\uD800-\uDBFF]$/, '');
    return cut + TRUNCATION_MARKER;
  }

  private describe(cause: unknown): string {
    if (cause instanceof Error) {
      return `${cause.name}: ${cause.message}`;
    }
    try {
      const json = JSON.stringify(cause);
      if (json !== undefined && json !== '{}') {
        return json;
      }
      return String(cause);
    } catch {
      try {
        return String(cause);
      } catch {
        return '[unrenderable cause]';
      }
    }
  }
}

export { Reporter };
