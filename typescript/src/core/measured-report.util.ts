import type { AssertionCount, Measurement, SuggestedGate } from './measurement.js';
import { Measurer } from './measurer.util.js';
import { TextFormat } from './text-format.util.js';

type MeasuredHeadline = {
  readonly measurement: Measurement;
  readonly threshold: number;
  readonly gateRuns: number;
  readonly name?: string;
  readonly countsLine: string;
};

class MeasuredReport {
  private static readonly WIDE_RANGE_BELOW = 30;
  private static readonly ASSERTION = 'coherent';
  private static readonly CLAIM_INDENT = '  ';
  private static readonly CONTINUATION_INDENT = '    ';
  private static readonly NONE_CAUGHT = 0;
  private static readonly ALL_CAUGHT = 100;

  private readonly text = new TextFormat();
  private readonly measurer = new Measurer();

  headline({ measurement, threshold, gateRuns, name, countsLine }: MeasuredHeadline): string {
    const named = name === undefined ? '' : `${name}: `;
    if (measurement.outcome === 'errored') {
      return [
        `ERRORED, not failed: ${named}no run settled as passed or failed, so there is nothing to measure.`,
        countsLine,
      ].join('\n');
    }
    const { passed, settled, rate, low, high, meetsTarget, suggestion, sharper } = measurement;
    const lines = [
      `MEASURED: ${named}${passed} of ${settled} settled runs passed (pass rate ${rate}, likely ${low}–${high}); ` +
        `threshold ${threshold} not enforced, ${meetsTarget ? 'meets' : 'below'} target.`,
      countsLine,
      this.suggestionLine(suggestion, gateRuns),
    ];
    if (sharper !== null) {
      lines.push(this.sharperLine(sharper));
    }
    if (settled < MeasuredReport.WIDE_RANGE_BELOW) {
      lines.push(
        `Measured with only ${settled} settled run(s); the range is wide. ` +
          'Set CRUCIBLE_MEASURE_RUNS=50 for a firmer suggestion.',
      );
    }
    return lines.join('\n');
  }

  breakdown(counts: readonly AssertionCount[]): string[] {
    if (counts.length < 2) {
      return [];
    }
    return [['By assertion:', ...counts.map((count) => this.assertionLine(count))].join('\n')];
  }

  private assertionLine({ claim, passed, evaluated }: AssertionCount): string {
    const label = this.text.indented(
      `${MeasuredReport.ASSERTION} "${claim}"`,
      MeasuredReport.CONTINUATION_INDENT,
    );
    const line = `${MeasuredReport.CLAIM_INDENT}${label}: ${passed} of ${evaluated} passed`;
    if (passed === evaluated) {
      return line;
    }
    const { low, high } = this.measurer.range(passed, evaluated);
    return `${line} (pass rate ${Measurer.rate(passed, evaluated)}, likely ${low}–${high})`;
  }

  private suggestionLine(suggestion: SuggestedGate | null, gateRuns: number): string {
    if (suggestion === null) {
      return (
        `No useful gate at runs ${gateRuns}: even needing 1 of ${gateRuns} would fail an unchanged system ` +
        'on over 5% of builds. Raise runs, or measure with more runs.'
      );
    }
    const gate = `Suggested gate: runs ${suggestion.runs}, threshold ${suggestion.threshold}. An unchanged system fails it on under 5% of builds`;
    return suggestion.drop === undefined
      ? `${gate}.`
      : `${gate}; a drop to ${suggestion.drop} fails it on ${this.caught(suggestion)}.`;
  }

  private sharperLine(sharper: SuggestedGate): string {
    const gate = `Sharper gate: runs ${sharper.runs}, threshold ${sharper.threshold}.`;
    return sharper.drop === undefined
      ? gate
      : `${gate} A drop to ${sharper.drop} fails it on ${this.caught(sharper)}.`;
  }

  private caught({ caught }: SuggestedGate): string {
    if (caught === MeasuredReport.NONE_CAUGHT) {
      return 'under 1%';
    }
    if (caught === MeasuredReport.ALL_CAUGHT) {
      return 'over 99%';
    }
    return `${caught}%`;
  }
}

export { MeasuredReport };
