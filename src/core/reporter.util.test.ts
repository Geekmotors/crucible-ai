import { describe, expect, it } from '@jest/globals';
import { ClaimText } from './test/claim-text.enum.js';
import { ExtractTarget } from './test/extract-target.enum.js';
import { ReportHarness } from './test/report-harness.util.js';
import { VerbosityLevel } from './test/verbosity-level.enum.js';

describe('Reporter — causes that are not errors', () => {
  it('renders a non-Error object rejection legibly, never as [object Object]', () => {
    const message = ReportHarness.renderedFailure({ code: 'ECONNRESET' });
    expect(message).not.toContain('[object Object]');
    expect(message).toContain('ECONNRESET');
  });

  it('renders a thrown string legibly', () => {
    expect(ReportHarness.renderedFailure('the body gave up')).toContain('the body gave up');
  });

  it('still reports a failed run that carries no cause', () => {
    expect(ReportHarness.renderedFailure(undefined)).toContain('[FAILED] Run #1');
  });

  it('survives a cause whose stringification throws', () => {
    const hostile = {
      toString(): string {
        throw new Error('nope');
      },
    };
    const message = ReportHarness.renderedFailure(hostile);
    expect(message).toMatch(/unrenderable/i);
  });
});

describe('Reporter — records held out of recording order', () => {
  it('names the earliest false verdict as the first failure', () => {
    const message = ReportHarness.renderedLedger('failed', {
      verdicts: [
        ReportHarness.verdict(ClaimText.NamesPrice, false, 4),
        ReportHarness.verdict(ClaimText.KeepsSecret, false, 1),
      ],
    });
    expect(message).toContain(`Claim: ${ClaimText.KeepsSecret}`);
    expect(message).not.toContain(ClaimText.NamesPrice);
  });

  it('numbers extractions in the order they were made', () => {
    const message = ReportHarness.renderedLedger('failed', {
      extractions: [
        ReportHarness.extraction(ExtractTarget.City, 3),
        ReportHarness.extraction(ExtractTarget.Apples, 1),
      ],
    });
    expect(message).toContain(`Extraction 1 of 2 (lenient): "${ExtractTarget.Apples}"`);
  });

  it('reports the attempts of the earliest judge error of an errored run', () => {
    const message = ReportHarness.renderedLedger('errored', {
      errors: [ReportHarness.judgeError(1, 3), ReportHarness.judgeError(2, 1)],
    });
    expect(message).toContain('Judge attempts: 2');
  });

  it('lists every judge call in recording order at full verbosity', () => {
    const message = ReportHarness.renderedLedger(
      'failed',
      {
        verdicts: [
          ReportHarness.verdict(ClaimText.NamesPrice, false, 2),
          ReportHarness.verdict(ClaimText.KeepsSecret, true, 0),
        ],
        errors: [ReportHarness.judgeError(3, 1)],
      },
      VerbosityLevel.Full,
    );
    expect(message).toContain('Judge call 1 of 3: coherent verdict true');
    expect(message).toContain('Judge call 2 of 3: errored after 3 attempt(s)');
    expect(message).toContain('Judge call 3 of 3: coherent verdict false');
  });
});
