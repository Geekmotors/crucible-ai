import type { CompletionRequest } from '../providers/types.js';
import { DEFAULT_REPORT_SETTINGS } from './report-settings.js';
import type { ResolvedRunOptions, RunOptions } from './run-options.js';
import type { RunResult, RunTally } from './run-result.js';
import { RunScope, runScope } from './state.js';
import type { ErrorRecord, VerdictRecord } from './state.js';
import { TextFormat } from './text-format.util.js';
import type { Verbosity } from './verbosity.js';

type OutputWriter = (text: string) => void;

type TraceSettings = {
  readonly verbosity: Verbosity;
  readonly provider: string;
  readonly model: string;
  readonly meta?: Readonly<Record<string, unknown>>;
  readonly testDefaults: RunOptions;
  readonly excerptChars: number;
};

type TraceSettingsSupplier = () => TraceSettings;

type ProviderFailureOutcome =
  | { readonly next: 'retry'; readonly delayMs: number }
  | { readonly next: 'fatal' | 'exhausted' | 'aborted' };

class TraceReporter {
  private static readonly PREFIX = '[crucible:debug]';
  private static readonly BODY_INDENT = '    ';
  private static readonly PAYLOAD_CHARS = 2000;
  private static readonly TRUNCATION_MARKER = '…';
  private static readonly FAILURE_NEXT = {
    fatal: 'fatal, not retried',
    exhausted: 'retryable, but no attempts left',
    aborted: 'the call was aborted',
  } as const;

  private readonly text = new TextFormat();
  private announced = false;

  private static quiet(): TraceSettings {
    return {
      verbosity: 'default',
      provider: '',
      model: '',
      testDefaults: {},
      excerptChars: DEFAULT_REPORT_SETTINGS.excerptChars,
    };
  }

  private static stdout(text: string): void {
    process.stdout.write(text);
  }

  constructor(
    private readonly settings: TraceSettingsSupplier = TraceReporter.quiet,
    private readonly scope: RunScope = runScope,
    private readonly write: OutputWriter = TraceReporter.stdout,
  ) {}

  reportPassed(render: () => string): void {
    if (this.settings().verbosity !== 'default') {
      this.deliver(`${render()}\n`);
    }
  }

  testStarted(options: ResolvedRunOptions, deadlineMs: number): void {
    if (this.tracing()) {
      this.emit(
        `test started: ${options.runs} run(s) at threshold ${options.threshold}, ` +
          `deadline ${deadlineMs} ms`,
      );
    }
  }

  runSettled(run: number, result: RunResult): void {
    if (!this.tracing()) {
      return;
    }
    const cause = result.cause === undefined ? '' : `: ${this.text.describe(result.cause)}`;
    this.emit(`run #${run} settled ${result.status}${cause}`);
  }

  testAborted(cause: unknown, results: readonly RunResult[]): void {
    if (this.tracing()) {
      this.emit(
        `test aborted on a fatal error: ${this.text.describe(cause)}; ` +
          `${this.discarded(results)} in-flight run(s) discarded`,
      );
    }
  }

  testExpired(deadlineMs: number, results: readonly RunResult[]): void {
    if (this.tracing()) {
      this.emit(
        `test deadline of ${deadlineMs} ms expired; ` +
          `${this.discarded(results)} in-flight run(s) discarded`,
      );
    }
  }

  verdictReached(tally: RunTally, options: ResolvedRunOptions): void {
    if (this.tracing()) {
      this.emit(
        `verdict ${tally.zone}: ${tally.passed} passed, ${tally.failed} failed, ` +
          `${tally.errored} errored of ${options.runs} (need ${tally.need})`,
      );
    }
  }

  providerRequest(provider: string, request: CompletionRequest, attempt: number): void {
    if (!this.tracing()) {
      return;
    }
    const system = request.system === undefined ? 'none' : `${request.system.length} chars`;
    this.emit(
      `provider request attempt ${attempt} to "${provider}": model "${request.model}", ` +
        `system prompt ${system}, meta keys [${this.metaKeys(request.meta)}]`,
      this.payload('prompt', request.prompt),
    );
  }

  providerResponse(attempt: number, reply: string): void {
    if (this.tracing()) {
      this.emit(`provider response attempt ${attempt}`, this.payload('reply', reply));
    }
  }

  providerFailure(attempt: number, cause: unknown, outcome: ProviderFailureOutcome): void {
    if (!this.tracing()) {
      return;
    }
    const next =
      outcome.next === 'retry'
        ? `retryable, retrying in ${Math.round(outcome.delayMs)} ms`
        : TraceReporter.FAILURE_NEXT[outcome.next];
    this.emit(`provider attempt ${attempt} failed (${next}): ${this.text.describe(cause)}`);
  }

  judgeReplyRejected(ask: number, failure: unknown): void {
    if (this.tracing()) {
      this.emit(`judge reply ${ask} unusable: ${this.text.describe(failure)}`);
    }
  }

  judgeRecorded(record: VerdictRecord | ErrorRecord): void {
    if (!this.tracing()) {
      return;
    }
    if ('verdict' in record) {
      this.emit(
        `judge verdict ${record.verdict} for ${record.assertion} "${record.claim}"`,
        this.payload('reasoning', record.reasoning),
      );
      return;
    }
    this.emit(
      `judge call errored after ${record.attempts} attempt(s): ${this.text.describe(record.cause)}`,
    );
  }

  private tracing(): boolean {
    return this.settings().verbosity === 'debug';
  }

  private emit(headline: string, body?: string): void {
    if (!this.announced) {
      this.announced = true;
      this.deliver(this.header());
    }
    const run = this.scope.runNumber();
    const tag = run === undefined ? '' : `run #${run} `;
    const lines = [
      `${TraceReporter.PREFIX} ${tag}${this.text.indented(headline, TraceReporter.BODY_INDENT)}`,
    ];
    if (body !== undefined) {
      lines.push(TraceReporter.BODY_INDENT + this.text.indented(body, TraceReporter.BODY_INDENT));
    }
    this.deliver(`${lines.join('\n')}\n`);
  }

  private deliver(text: string): void {
    try {
      this.write(text);
    } catch {
      return;
    }
  }

  private header(): string {
    const { verbosity, provider, model, meta, testDefaults, excerptChars } = this.settings();
    return (
      `${TraceReporter.PREFIX} engine init: verbosity ${verbosity}, trace written to stdout\n` +
      `${TraceReporter.PREFIX} config resolved: provider "${provider}", model "${model}", ` +
      `meta keys [${this.metaKeys(meta)}] (values not shown), ` +
      `testDefaults ${JSON.stringify(testDefaults)}, excerptChars ${excerptChars}\n`
    );
  }

  private payload(label: string, value: string): string {
    if (value.length <= TraceReporter.PAYLOAD_CHARS) {
      return `${label} (${value.length} chars): ${value}`;
    }
    const cut = this.text.cut(value, TraceReporter.PAYLOAD_CHARS);
    return (
      `${label} (first ${cut.length} of ${value.length} chars): ` +
      cut +
      TraceReporter.TRUNCATION_MARKER
    );
  }

  private metaKeys(meta: Readonly<Record<string, unknown>> | undefined): string {
    return Object.keys(meta ?? {}).join(', ');
  }

  private discarded(results: readonly RunResult[]): number {
    return results.filter((result) => result.status === 'discarded').length;
  }
}

export { TraceReporter };
export type { OutputWriter, ProviderFailureOutcome, TraceSettings, TraceSettingsSupplier };
