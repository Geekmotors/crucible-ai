import { TextFormat } from './text-format.util.js';
import { DEFAULT_REPORT_SETTINGS } from './report-settings.js';
import type { ReportSettings, ReportSettingsSupplier } from './report-settings.js';
import type {
  AbortSummary,
  ExpirySummary,
  FatalSummary,
  RunResult,
  RunStatus,
  RunTally,
  VerdictSummary,
} from './run-result.js';
import type { ResolvedRunOptions } from './run-options.js';
import type { ErrorRecord, RunContext, VerdictRecord } from './state.js';

type FirstFailure =
  | {
      readonly kind: 'verdict';
      readonly record: VerdictRecord;
      readonly position: number;
      readonly judged: number;
    }
  | { readonly kind: 'error'; readonly record: ErrorRecord }
  | { readonly kind: 'none' };

type JudgeCall =
  | { readonly kind: 'verdict'; readonly record: VerdictRecord }
  | { readonly kind: 'error'; readonly record: ErrorRecord };

type NumberedRun = {
  readonly result: RunResult;
  readonly number: number;
};

class Reporter {
  private static readonly FULL_SECTIONS_PER_STATUS = 3;
  private static readonly SMOKE_RUNS = 1;
  private static readonly RATE_SCALE = 1000;
  private static readonly RATE_EPSILON = 1e-9;
  private static readonly FAILED = 'FAILED:';
  private static readonly ERRORED = 'ERRORED, not failed:';
  private static readonly PASSED = 'PASSED:';
  private static readonly SMOKE = 'the smoke run (runs: 1)';
  private static readonly FIELD_INDENT = '  ';
  private static readonly CONTINUATION_INDENT = '    ';
  private static readonly NESTED_INDENT = '    ';
  private static readonly TRUNCATION_MARKER = '…';
  private static readonly FATAL_ADVICE =
    'Fix the provider setup (API key, model) or configuration and rerun.';
  private static readonly EXPIRY_ADVICE =
    'Check for a slow system under test or a throttled judge provider.';

  private static defaultSettings(): ReportSettings {
    return DEFAULT_REPORT_SETTINGS;
  }

  private readonly text = new TextFormat();

  constructor(private readonly settings: ReportSettingsSupplier = Reporter.defaultSettings) {}

  renderPassed(summary: VerdictSummary): string {
    return this.compose(this.passHeadline(summary), summary);
  }

  renderVerdict(summary: VerdictSummary): string {
    return this.compose(this.verdictHeadline(summary), summary);
  }

  renderAborted(summary: FatalSummary): string {
    return this.compose(this.abortHeadline(summary), summary, summary.fatal);
  }

  renderExpired(summary: ExpirySummary): string {
    return this.compose(this.expiryHeadline(summary), summary);
  }

  private compose(headline: string, { results, options }: AbortSummary, fatal?: unknown): string {
    const top = this.isSmoke(options.runs) ? headline : `${headline}\n${this.countsLine(results)}`;
    return [top, ...this.runSections(results, fatal)].join('\n\n');
  }

  private passHeadline({ tally, options }: VerdictSummary): string {
    if (this.isSmoke(options.runs)) {
      return `${Reporter.PASSED} ${Reporter.SMOKE} passed.`;
    }
    return `${Reporter.PASSED} ${this.rateClause(tally, options)}.`;
  }

  private rateClause(tally: RunTally, options: ResolvedRunOptions): string {
    return (
      `${tally.passed}/${options.runs} runs passed (pass rate ${this.passRate(tally.passed, options.runs)}) ` +
      `against threshold ${options.threshold} (need ${tally.need})`
    );
  }

  private verdictHeadline({ tally, options }: VerdictSummary): string {
    if (this.isSmoke(options.runs)) {
      return tally.zone === 'errored'
        ? `${Reporter.ERRORED} ${Reporter.SMOKE} hit an infrastructure problem, so there is no verdict.`
        : `${Reporter.FAILED} ${Reporter.SMOKE} did not pass.`;
    }
    const rate = this.rateClause(tally, options);
    if (tally.zone === 'errored') {
      return `${Reporter.ERRORED} ${rate}; ${tally.errored} errored run(s) left the result inconclusive.`;
    }
    return `${Reporter.FAILED} ${rate}.`;
  }

  private abortHeadline({ results, options }: AbortSummary): string {
    if (this.isSmoke(options.runs)) {
      return `${Reporter.ERRORED} ${Reporter.SMOKE} aborted on a fatal error. ${Reporter.FATAL_ADVICE}`;
    }
    return (
      `${Reporter.ERRORED} aborted on a fatal error after ${this.settledClause(results, options.runs)}. ` +
      Reporter.FATAL_ADVICE
    );
  }

  private expiryHeadline({ results, options, deadlineMs }: ExpirySummary): string {
    const deadline = `did not finish within its ${deadlineMs} ms deadline`;
    if (this.isSmoke(options.runs)) {
      return `${Reporter.ERRORED} ${Reporter.SMOKE} ${deadline}. ${Reporter.EXPIRY_ADVICE}`;
    }
    return (
      `${Reporter.ERRORED} the test ${deadline}; ${this.settledClause(results, options.runs)}. ` +
      Reporter.EXPIRY_ADVICE
    );
  }

  private settledClause(results: readonly RunResult[], runs: number): string {
    const discarded = this.count(results, 'discarded');
    const settled = `${results.length - discarded}/${runs} runs settled`;
    return discarded > 0
      ? `${settled}; ${discarded} in-flight run(s) discarded to stop spend`
      : settled;
  }

  private countsLine(results: readonly RunResult[]): string {
    return (
      `Runs: ${this.count(results, 'passed')} passed, ${this.count(results, 'failed')} failed, ` +
      `${this.count(results, 'errored')} errored, ${this.count(results, 'discarded')} discarded.`
    );
  }

  private runSections(results: readonly RunResult[], fatal: unknown): string[] {
    const numbered = results.map((result, index) => ({ result, number: index + 1 }));
    const failed = this.withStatus(numbered, 'failed');
    const errored = this.fatalFirst(this.withStatus(numbered, 'errored'), fatal);
    const discarded = this.withStatus(numbered, 'discarded');
    if (this.isFull()) {
      return [
        ...failed.map((run) => this.withJudgeCalls(this.failedSection(run), run)),
        ...errored.map((run) => this.withJudgeCalls(this.erroredSection(run), run)),
        ...this.withStatus(numbered, 'passed').map((run) =>
          this.withJudgeCalls(`[PASSED] Run #${run.number}`, run),
        ),
        ...discarded.map((run) =>
          this.withJudgeCalls(
            `[DISCARDED] Run #${run.number} (cut off in flight; counted in no zone)`,
            run,
          ),
        ),
      ];
    }
    const sections = [
      ...this.shown(failed).map((run) => this.failedSection(run)),
      ...this.hiddenSummary(failed, 'failed'),
      ...this.claimTally(failed),
      ...this.shown(errored).map((run) => this.erroredSection(run)),
      ...this.hiddenSummary(errored, 'errored'),
    ];
    if (discarded.length > 0) {
      sections.push(
        `[DISCARDED] Run(s) ${this.ranges(discarded)}: still in flight when the test was cut off; counted in no zone.`,
      );
    }
    return sections;
  }

  private withJudgeCalls(section: string, { result }: NumberedRun): string {
    const calls = this.judgeCalls(result.context);
    if (calls.length === 0) {
      return `${section}\n${this.field('Judge calls', 'none recorded')}`;
    }
    return [
      section,
      ...calls.map((call, index) => this.judgeCallLines(call, index + 1, calls.length)),
    ].join('\n');
  }

  private judgeCalls(context: RunContext): JudgeCall[] {
    return [
      ...context.verdicts.map((record) => ({ kind: 'verdict' as const, record })),
      ...context.errors.map((record) => ({ kind: 'error' as const, record })),
    ].sort((left, right) => left.record.seq - right.record.seq);
  }

  private judgeCallLines(call: JudgeCall, position: number, total: number): string {
    const heading = `Judge call ${position} of ${total}`;
    if (call.kind === 'error') {
      return [
        this.field(heading, `errored after ${call.record.attempts} attempt(s)`),
        this.field('Judge error', this.text.describe(call.record.cause), Reporter.NESTED_INDENT),
      ].join('\n');
    }
    const { record } = call;
    return [
      this.field(heading, `${record.assertion} verdict ${String(record.verdict)}`),
      this.field('Claim', record.claim, Reporter.NESTED_INDENT),
      this.field('Judge reasoning', record.reasoning, Reporter.NESTED_INDENT),
      this.excerptField(record.response, Reporter.NESTED_INDENT),
    ].join('\n');
  }

  private fatalFirst(runs: readonly NumberedRun[], fatal: unknown): NumberedRun[] {
    if (fatal === undefined) {
      return [...runs];
    }
    const isFatal = ({ result }: NumberedRun): boolean => result.cause === fatal;
    return [...runs.filter(isFatal), ...runs.filter((run) => !isFatal(run))];
  }

  private shown(runs: readonly NumberedRun[]): readonly NumberedRun[] {
    return runs.slice(0, Reporter.FULL_SECTIONS_PER_STATUS);
  }

  private hidden(runs: readonly NumberedRun[]): readonly NumberedRun[] {
    return runs.slice(Reporter.FULL_SECTIONS_PER_STATUS);
  }

  private hiddenSummary(runs: readonly NumberedRun[], status: RunStatus): string[] {
    const hidden = this.hidden(runs);
    if (hidden.length === 0) {
      return [];
    }
    return [`+ ${hidden.length} more ${status} run(s) not shown in full: ${this.ranges(hidden)}.`];
  }

  private claimTally(failed: readonly NumberedRun[]): string[] {
    if (this.hidden(failed).length === 0) {
      return [];
    }
    const counts = new Map<string, number>();
    for (const { result } of failed) {
      const label = this.failureLabel(this.firstFailure(result.context));
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    const lines = [...counts.entries()]
      .sort(([, left], [, right]) => right - left)
      .map(([label, count]) => `${Reporter.FIELD_INDENT}${count} run(s): ${label}`);
    return [
      [
        `Failing claims (first failure of each of the ${failed.length} failed runs):`,
        ...lines,
      ].join('\n'),
    ];
  }

  private failureLabel(first: FirstFailure): string {
    if (first.kind === 'verdict') {
      return this.indented(`${first.record.assertion} "${first.record.claim}"`);
    }
    if (first.kind === 'error') {
      return 'a judge call errored';
    }
    return 'thrown without a false verdict';
  }

  private failedSection({ result, number }: NumberedRun): string {
    return [`[FAILED] Run #${number}`, ...this.failureFields(result)].join('\n');
  }

  private failureFields(result: RunResult): string[] {
    const first = this.firstFailure(result.context);
    const thrown = this.field('Thrown', this.text.describe(result.cause));
    if (first.kind === 'none') {
      return [this.field('First failure', 'no assertion returned false; the body threw'), thrown];
    }
    if (first.kind === 'error') {
      return [
        this.field(
          'First failure',
          `a judge call errored after ${first.record.attempts} attempt(s)`,
        ),
        this.field('Judge error', this.text.describe(first.record.cause)),
        thrown,
      ];
    }
    return [
      this.field(
        'First failed assertion',
        `${first.record.assertion} (assertion ${first.position} of ${first.judged} judged in this run)`,
      ),
      this.field('Claim', first.record.claim),
      this.field('Judge reasoning', first.record.reasoning),
      this.excerptField(first.record.response),
      thrown,
    ];
  }

  private erroredSection({ result, number }: NumberedRun): string {
    const lines = [
      `[ERRORED] Run #${number} (infrastructure, not a semantic failure)`,
      this.field('Cause', this.text.describe(result.cause)),
    ];
    const attempts = this.lowestSeqError(result.context)?.attempts;
    if (attempts !== undefined) {
      lines.push(this.field('Judge attempts', String(attempts)));
    }
    return lines.join('\n');
  }

  private firstFailure(context: RunContext): FirstFailure {
    const judged = [...context.verdicts].sort((left, right) => left.seq - right.seq);
    const index = judged.findIndex((record) => !record.verdict);
    const error = this.lowestSeqError(context);
    const verdict = index === -1 ? undefined : judged[index];
    if (verdict !== undefined && (error === undefined || verdict.seq < error.seq)) {
      return { kind: 'verdict', record: verdict, position: index + 1, judged: judged.length };
    }
    if (error !== undefined) {
      return { kind: 'error', record: error };
    }
    return { kind: 'none' };
  }

  private lowestSeqError(context: RunContext): ErrorRecord | undefined {
    return context.errors.reduce<ErrorRecord | undefined>(
      (lowest, record) => (lowest === undefined || record.seq < lowest.seq ? record : lowest),
      undefined,
    );
  }

  private excerptField(response: string, indent: string = Reporter.FIELD_INDENT): string {
    const limit = this.settings().excerptChars;
    if (response.length <= limit) {
      return this.field('Response excerpt', response, indent);
    }
    const cut = this.text.cut(response, limit);
    return this.field(
      `Response excerpt (first ${cut.length} of ${response.length} chars)`,
      cut + Reporter.TRUNCATION_MARKER,
      indent,
    );
  }

  private field(label: string, value: string, indent: string = Reporter.FIELD_INDENT): string {
    const continued = this.text.indented(value, indent + Reporter.FIELD_INDENT);
    return `${indent}${label}: ${continued}`.replace(/[ \t]+$/gm, '');
  }

  private indented(value: string): string {
    return this.text.indented(value, Reporter.CONTINUATION_INDENT);
  }

  private ranges(runs: readonly NumberedRun[]): string {
    const spans: [number, number][] = [];
    for (const { number } of runs) {
      const last = spans.at(-1);
      if (last !== undefined && last[1] + 1 === number) {
        last[1] = number;
      } else {
        spans.push([number, number]);
      }
    }
    return spans
      .map(([start, end]) => (start === end ? `#${start}` : `#${start}-#${end}`))
      .join(', ');
  }

  private passRate(passed: number, runs: number): number {
    return (
      Math.floor((passed / runs) * Reporter.RATE_SCALE + Reporter.RATE_EPSILON) /
      Reporter.RATE_SCALE
    );
  }

  private withStatus(runs: readonly NumberedRun[], status: RunStatus): NumberedRun[] {
    return runs.filter(({ result }) => result.status === status);
  }

  private count(results: readonly RunResult[], status: RunStatus): number {
    return results.filter((result) => result.status === status).length;
  }

  private isFull(): boolean {
    return this.settings().verbosity !== 'default';
  }

  private isSmoke(runs: number): boolean {
    return runs === Reporter.SMOKE_RUNS;
  }
}

export { Reporter };
