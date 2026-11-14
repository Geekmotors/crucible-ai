import { describe, expect, it } from '@jest/globals';
import { CrucibleError } from './errors.js';
import { AssertionName } from './test/assertion-name.enum.js';
import { BlankValue } from './test/blank-value.enum.js';
import { ClaimText } from './test/claim-text.enum.js';
import { ExcerptChars } from './test/excerpt-chars.enum.js';
import { ExtractModeName } from './test/extract-mode-name.enum.js';
import { ExtractTarget } from './test/extract-target.enum.js';
import { ExtractText } from './test/extract-text.enum.js';
import { MultilineText } from './test/multiline-text.enum.js';
import { NearMiss } from './test/near-miss.enum.js';
import { ProviderFault } from './test/provider-fault.enum.js';
import { ReportBound } from './test/report-bound.enum.js';
import { ReportHarness } from './test/report-harness.util.js';
import { ReportText } from './test/report-text.enum.js';
import { RunCount } from './test/run-count.enum.js';
import { Threshold } from './test/threshold.enum.js';
import { TimeoutBudget } from './test/timeout-budget.enum.js';

describe('Reporter — a failed run', () => {
  it('renders the claim, the response, and the judge reasoning for a false verdict', () => {
    const message = ReportHarness.renderedFailure([
      ReportHarness.falseVerdict({
        claim: 'the answer stays on topic',
        response: 'a wandering answer',
        reasoning: 'the answer drifts away from the question',
      }),
    ]);
    expect(message).toContain('the answer stays on topic');
    expect(message).toContain('a wandering answer');
    expect(message).toContain('the answer drifts away from the question');
  });

  it('names the assertion that failed', () => {
    const message = ReportHarness.renderedFailure([ReportHarness.falseVerdict()]);
    expect(message).toContain(AssertionName.Coherent);
  });

  it('also names the thrown failure so an unrelated crash is never hidden by a verdict', () => {
    const message = ReportHarness.renderedFailure(
      [ReportHarness.falseVerdict()],
      new TypeError('cannot read x of undefined'),
    );
    expect(message).toContain('cannot read x of undefined');
  });

  it('truncates a long response to 500 characters, marks the cut, and states the full length', () => {
    const response = 'x'.repeat(ExcerptChars.Default + 100);
    const message = ReportHarness.renderedFailure([ReportHarness.falseVerdict({ response })]);
    expect(message).toContain('x'.repeat(ExcerptChars.Default) + '…');
    expect(message).not.toContain('x'.repeat(ExcerptChars.Default + 1));
    expect(message).toContain(
      `first ${ExcerptChars.Default} of ${ExcerptChars.Default + 100} chars`,
    );
  });

  it('renders a response at the 500-character limit whole, without a truncation marker', () => {
    const response = 'y'.repeat(ExcerptChars.Default);
    const message = ReportHarness.renderedFailure([ReportHarness.falseVerdict({ response })]);
    expect(message).toContain(response);
    expect(message).not.toContain('…');
  });

  it('cuts the excerpt at the configured length', () => {
    const response = 'w'.repeat(ExcerptChars.Default);
    const message = ReportHarness.renderedFailure(
      [ReportHarness.falseVerdict({ response })],
      new Error('boom'),
      [],
      ReportHarness.reporter(ExcerptChars.Short),
    );
    expect(message).toContain('w'.repeat(ExcerptChars.Short) + '…');
    expect(message).not.toContain('w'.repeat(ExcerptChars.Short + 1));
  });

  it('never cuts a surrogate pair in half at the excerpt boundary', () => {
    const response = 'z'.repeat(ExcerptChars.Default - 1) + '😀' + 'tail';
    const message = ReportHarness.renderedFailure([ReportHarness.falseVerdict({ response })]);
    expect(message).not.toMatch(/[\uD800-\uDBFF]…/);
    expect(message).toContain('…');
  });

  it('states the excerpt length actually shown when a surrogate pair is held back', () => {
    const response = 'z'.repeat(ExcerptChars.Default - 1) + '😀' + 'tail';
    const message = ReportHarness.renderedFailure([ReportHarness.falseVerdict({ response })]);
    expect(message).toContain(`first ${ExcerptChars.Default - 1} of ${response.length} chars`);
  });

  it('never renders an empty excerpt when the first character is a surrogate pair', () => {
    const message = ReportHarness.renderedFailure(
      [ReportHarness.falseVerdict({ response: '😀tail' })],
      new Error('boom'),
      [],
      ReportHarness.reporter(ExcerptChars.Minimal),
    );
    expect(message).toContain('😀…');
  });

  it('renders only the lowest-seq false verdict when several exist', () => {
    const message = ReportHarness.renderedFailure([
      ReportHarness.falseVerdict({ claim: 'later claim', reasoning: 'later reasoning', seq: 4 }),
      ReportHarness.falseVerdict({ claim: 'first claim', reasoning: 'first reasoning', seq: 1 }),
    ]);
    expect(message).toContain('first claim');
    expect(message).toContain('first reasoning');
    expect(message).not.toContain('later claim');
    expect(message).not.toContain('later reasoning');
  });

  it('skips true verdicts when picking the failing one', () => {
    const message = ReportHarness.renderedFailure([
      ReportHarness.falseVerdict({ claim: 'passing claim', verdict: true, seq: 0 }),
      ReportHarness.falseVerdict({ claim: 'failing claim', reasoning: 'the mismatch', seq: 2 }),
    ]);
    expect(message).toContain('failing claim');
    expect(message).toContain('the mismatch');
    expect(message).not.toContain('passing claim');
  });

  it('names which of several assertions in one body failed', () => {
    const message = ReportHarness.renderedFailure([
      ReportHarness.falseVerdict({ claim: 'first claim', verdict: true, seq: 0 }),
      ReportHarness.falseVerdict({ claim: 'second claim', seq: 1 }),
      ReportHarness.falseVerdict({ claim: 'third claim', verdict: true, seq: 2 }),
    ]);
    expect(message).toContain('second claim');
    expect(message).toContain('2 of 3');
  });

  it('picks the first failure across verdicts and error records by seq', () => {
    const message = ReportHarness.renderedFailure(
      [ReportHarness.falseVerdict({ claim: 'later claim', seq: 3 })],
      new Error('terminal'),
      [{ cause: new Error('earlier judge outage'), attempts: 2, seq: 1 }],
    );
    expect(message).toContain('earlier judge outage');
    expect(message).not.toContain('later claim');
  });

  it('falls back to the original cause when no false verdict was recorded', () => {
    const cause = new RangeError('index out of bounds');
    const message = ReportHarness.renderedFailure([], cause);
    expect(message).toContain('RangeError');
    expect(message).toContain('index out of bounds');
  });

  it('renders a non-Error object rejection legibly, never as [object Object]', () => {
    const message = ReportHarness.renderedFailure([], { code: 'ECONNRESET' });
    expect(message).not.toContain('[object Object]');
    expect(message).toContain('ECONNRESET');
  });

  it('survives a cause whose stringification throws', () => {
    const hostile = {
      toString(): string {
        throw new Error('nope');
      },
    };
    const message = ReportHarness.renderedFailure([], hostile);
    expect(message).toMatch(/unrenderable/i);
  });

  it('indents the continuation lines of multi-line judge reasoning under its run', () => {
    const message = ReportHarness.renderedFailure([
      ReportHarness.falseVerdict({ reasoning: 'line one\nline two' }),
    ]);
    expect(message).toContain('line one\n    line two');
  });

  it('leaves blank lines inside a multi-line value free of trailing whitespace', () => {
    const message = ReportHarness.renderedFailure([], new Error('first\n\nlast'));
    expect(message).not.toMatch(/ +\n/);
  });

  it.each(Object.values(BlankValue))(
    'renders a thrown message %j without trailing whitespace on any line',
    (value) => {
      const message = ReportHarness.renderedFailure([], new Error(value));
      expect(message).not.toMatch(/[ \t]+$/m);
    },
  );

  it('indents continuation lines split by a lone carriage return', () => {
    const message = ReportHarness.renderedFailure([
      ReportHarness.falseVerdict({ reasoning: MultilineText.LoneCarriageReturn }),
    ]);
    expect(message).toContain(MultilineText.Indented);
  });

  it('marks a failed run with the failed marker, never the errored one', () => {
    const message = ReportHarness.renderedFailure([ReportHarness.falseVerdict()]);
    expect(message).toContain(`${ReportText.FailedRun} Run #1`);
    expect(message).not.toContain(ReportText.ErroredRun);
    expect(message).not.toMatch(/not failed/i);
  });
});

describe('Reporter — extractions in a failed run', () => {
  it('lists the run’s extraction under the failed run, so a failing toBe shows why the judge returned null', () => {
    const message = ReportHarness.renderedVerdict(
      [
        ReportHarness.extractingRun('failed', [
          ReportHarness.extraction({
            mode: ExtractModeName.Strict,
            reasoning: 'The speaker hedges with "probably".',
            response: 'Probably two apples.',
          }),
        ]),
      ],
      Threshold.Certain,
    );
    expect(message).toBe(
      [
        'FAILED: the smoke run (runs: 1) did not pass.',
        '',
        '[FAILED] Run #1',
        '  First failure: no assertion returned false; the body threw',
        '  Thrown: Error: failed',
        `  Extraction 1 of 1 (strict): "${ExtractTarget.Apples}" as number → null`,
        '    Judge reasoning: The speaker hedges with "probably".',
        '    Response excerpt: Probably two apples.',
      ].join('\n'),
    );
  });

  it('renders every extraction of the run in the order it was made, with its typed value', () => {
    const message = ReportHarness.renderedVerdict(
      [
        ReportHarness.extractingRun('failed', [
          ReportHarness.extraction({
            description: ExtractTarget.City,
            type: 'string',
            value: ExtractText.City,
            seq: 3,
          }),
          ReportHarness.extraction({ value: 2, seq: 1 }),
        ]),
      ],
      Threshold.Certain,
    );
    expect(message).toContain(
      `Extraction 1 of 2 (lenient): "${ExtractTarget.Apples}" as number → 2`,
    );
    expect(message).toContain(
      `Extraction 2 of 2 (lenient): "${ExtractTarget.City}" as string → "${ExtractText.City}"`,
    );
  });

  it('keeps naming the false coherent verdict as the first failed assertion', () => {
    const message = ReportHarness.renderedVerdict(
      [
        ReportHarness.extractingRun(
          'failed',
          [ReportHarness.extraction({ seq: 0 })],
          [ReportHarness.falseVerdict({ claim: ClaimText.NamesPrice, seq: 1 })],
        ),
      ],
      Threshold.Certain,
    );
    expect(message).toContain(
      `First failed assertion: ${AssertionName.Coherent} (assertion 1 of 1`,
    );
    expect(message).toContain(ClaimText.NamesPrice);
    expect(message).toContain(`Extraction 1 of 1 (lenient): "${ExtractTarget.Apples}"`);
  });

  it('bounds the extraction’s response excerpt at the configured length', () => {
    const response = 'w'.repeat(ExcerptChars.Default);
    const message = ReportHarness.renderedVerdict(
      [ReportHarness.extractingRun('failed', [ReportHarness.extraction({ response })])],
      Threshold.Certain,
      ReportHarness.reporter(ExcerptChars.Short),
    );
    expect(message).toContain('w'.repeat(ExcerptChars.Short) + '…');
    expect(message).not.toContain('w'.repeat(ExcerptChars.Short + 1));
  });

  it('lists extractions among the judge calls at full verbosity, without repeating them', () => {
    const message = ReportHarness.renderedVerdict(
      [
        ReportHarness.extractingRun('failed', [
          ReportHarness.extraction({ mode: ExtractModeName.Strict, value: 3 }),
        ]),
      ],
      Threshold.Certain,
      ReportHarness.fullReporter(),
    );
    expect(message).toContain(
      `Judge call 1 of 1: extract (strict) "${ExtractTarget.Apples}" as number → 3`,
    );
    expect(message).not.toContain('Extraction 1 of 1');
  });

  it('lists a passed run’s extractions at full verbosity', () => {
    const message = ReportHarness.renderedPass(
      [ReportHarness.extractingRun('passed', [ReportHarness.extraction({ value: 2 })])],
      Threshold.Certain,
    );
    expect(message).toContain(
      `Judge call 1 of 1: extract (lenient) "${ExtractTarget.Apples}" as number → 2`,
    );
  });
});

describe('Reporter — an errored run', () => {
  it('renders an errored run as errored, not failed, and names the infrastructure cause', () => {
    const message = ReportHarness.renderedErrored(
      new CrucibleError('infra', 'provider unreachable'),
    );
    expect(message).toContain(`${ReportText.ErroredRun} Run #1`);
    expect(message).not.toContain(ReportText.FailedRun);
    expect(message).toMatch(/not failed/i);
    expect(message).toContain('provider unreachable');
  });

  it('names the terminal rejection and the recorded attempt count for an errored run', () => {
    const message = ReportHarness.renderedErrored(
      new CrucibleError('infra', 'kept failing after 3 attempts'),
      [
        { cause: new Error('second outage'), attempts: 1, seq: 3 },
        { cause: new Error('first outage'), attempts: 2, seq: 1 },
      ],
    );
    expect(message).toContain('kept failing after 3 attempts');
    expect(message).toContain('Judge attempts: 2');
  });
});

describe('Reporter — verdict headline', () => {
  it('headlines the pass rate with passed count, run count, need, and threshold', () => {
    const message = ReportHarness.renderedVerdict(
      [
        ReportHarness.run('passed'),
        ReportHarness.run('failed', new Error('first miss')),
        ReportHarness.run('failed', new Error('second miss')),
      ],
      Threshold.Half,
    );
    expect(message.startsWith(ReportText.Failed)).toBe(true);
    expect(message).toContain('1/3');
    expect(message).toContain('need 2');
    expect(message).toContain(String(Threshold.Half));
  });

  it('states the pass rate as a decimal that never rounds up to the threshold', () => {
    const message = ReportHarness.renderedVerdict(
      [
        ReportHarness.run('passed'),
        ReportHarness.run('passed'),
        ReportHarness.run('failed', new Error('the miss')),
      ],
      Threshold.Certain,
    );
    expect(message).toContain('pass rate 0.666');
  });

  it('floors a pass rate just under the threshold instead of rounding it up to meet it', () => {
    const message = ReportHarness.renderedVerdict(
      [
        ...ReportHarness.runs(NearMiss.Passed, 'passed'),
        ...ReportHarness.runs(NearMiss.Runs - NearMiss.Passed, 'failed'),
      ],
      Threshold.Strict,
    );
    expect(message).toContain(ReportText.NearMissRate);
  });

  it('counts every run status under the headline', () => {
    const message = ReportHarness.renderedVerdict(
      [
        ReportHarness.run('passed'),
        ReportHarness.run('failed', new Error('the miss')),
        ReportHarness.run('failed', new Error('another miss')),
        ReportHarness.run('errored', new CrucibleError('infra', 'rate limited')),
      ],
      Threshold.Certain,
    );
    expect(message).toContain(`${ReportText.Counts} 1 passed, 2 failed, 1 errored, 0 discarded.`);
  });

  it('marks an inconclusive verdict as errored, not failed, naming each errored run cause shown', () => {
    const message = ReportHarness.renderedVerdict(
      [
        ReportHarness.run('passed'),
        ReportHarness.run('errored', new CrucibleError('infra', 'provider unreachable')),
        ReportHarness.run('errored', new CrucibleError('infra', 'rate limited')),
      ],
      Threshold.Certain,
    );
    expect(message.startsWith(ReportText.Errored)).toBe(true);
    expect(message).toContain('provider unreachable');
    expect(message).toContain('rate limited');
  });

  it('keeps a failing verdict free of the errored-run marker', () => {
    const message = ReportHarness.renderedVerdict(
      [ReportHarness.run('passed'), ReportHarness.run('failed', new Error('the miss'))],
      Threshold.Certain,
    );
    expect(message).not.toMatch(/not failed/i);
  });

  it("renders a failed run's claim and judge reasoning in its section", () => {
    const message = ReportHarness.renderedVerdict(
      [
        ReportHarness.run('failed', new Error('thrown'), [
          ReportHarness.falseVerdict({ claim: 'stays on topic', reasoning: 'it drifted' }),
        ]),
      ],
      Threshold.Certain,
    );
    expect(message).toContain('stays on topic');
    expect(message).toContain('it drifted');
  });

  it('gives passed runs no section of their own', () => {
    const message = ReportHarness.renderedVerdict(
      [ReportHarness.run('passed'), ReportHarness.run('failed', new Error('the miss'))],
      Threshold.Certain,
    );
    expect(message).not.toContain('Run #1');
    expect(message).toContain('Run #2');
  });

  it('never renders a discarded run as a failed section in a verdict report', () => {
    const message = ReportHarness.renderedVerdict(
      [ReportHarness.run('passed'), ReportHarness.run('discarded')],
      Threshold.Certain,
    );
    expect(message).toContain(`${ReportText.DiscardedRun} Run(s) #2`);
    expect(message).not.toContain(ReportText.FailedRun);
  });
});

describe('Reporter — smoke mode', () => {
  it('headlines a failed smoke run as failed without a pass-rate count', () => {
    const message = ReportHarness.renderedFailure([ReportHarness.falseVerdict()]);
    expect(message.startsWith(`${ReportText.Failed} ${ReportText.Smoke}`)).toBe(true);
    expect(message).not.toContain(ReportText.Counts);
  });

  it('headlines an errored smoke run as errored, not failed', () => {
    const message = ReportHarness.renderedErrored(new CrucibleError('infra', 'rate limited'));
    expect(message.startsWith(`${ReportText.Errored} ${ReportText.Smoke}`)).toBe(true);
  });

  it('headlines a fatal smoke run as aborted without claiming any run was discarded', () => {
    const message = ReportHarness.renderedAbort([
      ReportHarness.run('errored', new CrucibleError('infra', ProviderFault.InvalidKey)),
    ]);
    expect(message.startsWith(`${ReportText.Errored} ${ReportText.Smoke}`)).toBe(true);
    expect(message).toMatch(/aborted/i);
    expect(message).not.toMatch(/discarded/i);
  });

  it('headlines an expired smoke run with its deadline', () => {
    const message = ReportHarness.renderedExpiry(
      [ReportHarness.run('discarded')],
      TimeoutBudget.SmokeMs,
    );
    expect(message.startsWith(`${ReportText.Errored} ${ReportText.Smoke}`)).toBe(true);
    expect(message).toContain(String(TimeoutBudget.SmokeMs));
  });
});

describe('Reporter — aborted and expired tests', () => {
  it('headlines an aborted test as errored, not failed, and names the fatal cause', () => {
    const message = ReportHarness.renderedAbort([
      ReportHarness.run('errored', new CrucibleError('infra', ProviderFault.InvalidKey)),
      ReportHarness.run('discarded'),
    ]);
    expect(message.startsWith(ReportText.Errored)).toBe(true);
    expect(message).toMatch(/aborted/i);
    expect(message).toContain(ProviderFault.InvalidKey);
  });

  it('renders runs aborted in flight as discarded, never as failed', () => {
    const message = ReportHarness.renderedAbort([
      ReportHarness.run('errored', new CrucibleError('infra', ProviderFault.InvalidKey)),
      ReportHarness.run('discarded'),
      ReportHarness.run('discarded'),
    ]);
    expect(message).toContain(`${ReportText.DiscardedRun} Run(s) #2-#3`);
    expect(message).not.toContain(ReportText.FailedRun);
  });

  it('keeps a run settled before the abort under its own status', () => {
    const message = ReportHarness.renderedAbort([
      ReportHarness.run('failed', new Error('settled miss')),
      ReportHarness.run('errored', new CrucibleError('infra', ProviderFault.InvalidKey)),
      ReportHarness.run('discarded'),
    ]);
    expect(message).toContain(`${ReportText.FailedRun} Run #1`);
    expect(message).toContain('settled miss');
  });

  it('always shows the fatal run in full, even beyond the errored-run bound', () => {
    const fatal = new CrucibleError('infra', ProviderFault.InvalidKey);
    const message = ReportHarness.renderedAbort(
      [
        ...ReportHarness.runs(ReportBound.FullSections, 'errored'),
        ReportHarness.run('errored', fatal),
        ReportHarness.run('discarded'),
      ],
      fatal,
    );
    expect(message).toContain(`${ReportText.ErroredRun} Run #${ReportBound.FullSections + 1}`);
    expect(message).toContain(ProviderFault.InvalidKey);
  });

  it('counts every run status under an abort headline', () => {
    const message = ReportHarness.renderedAbort([
      ReportHarness.run('passed'),
      ReportHarness.run('errored', new CrucibleError('infra', ProviderFault.InvalidKey)),
      ReportHarness.run('discarded'),
    ]);
    expect(message).toContain(`${ReportText.Counts} 1 passed, 0 failed, 1 errored, 1 discarded.`);
  });

  it('headlines an expired test with its deadline, never as a pass-rate failure', () => {
    const message = ReportHarness.renderedExpiry(
      [ReportHarness.run('passed'), ReportHarness.run('discarded')],
      TimeoutBudget.SmokeMs,
    );
    expect(message.startsWith(ReportText.Errored)).toBe(true);
    expect(message).toContain(String(TimeoutBudget.SmokeMs));
    expect(message).not.toContain('pass rate');
  });

  it('renders runs cut off by the deadline as discarded and keeps settled runs', () => {
    const message = ReportHarness.renderedExpiry(
      [ReportHarness.run('failed', new Error('settled miss')), ReportHarness.run('discarded')],
      TimeoutBudget.SmokeMs,
    );
    expect(message).toContain(`${ReportText.FailedRun} Run #1`);
    expect(message).toContain(`${ReportText.DiscardedRun} Run(s) #2`);
  });
});

describe('Reporter — many failing runs', () => {
  it('renders only the first three failed runs in full', () => {
    const message = ReportHarness.renderedVerdict(
      ReportHarness.runs(RunCount.Gated, 'failed', ClaimText.Default),
      Threshold.Certain,
    );
    expect(message).toContain(`${ReportText.FailedRun} Run #${ReportBound.FullSections}`);
    expect(message).not.toContain(`${ReportText.FailedRun} Run #${ReportBound.FullSections + 1}`);
  });

  it('lists the failed runs not shown in full as a compressed range', () => {
    const message = ReportHarness.renderedVerdict(
      ReportHarness.runs(RunCount.Gated, 'failed', ClaimText.Default),
      Threshold.Certain,
    );
    const hidden = RunCount.Gated - ReportBound.FullSections;
    expect(message).toContain(
      `+ ${hidden} more failed run(s) not shown in full: #${ReportBound.FullSections + 1}-#${RunCount.Gated}`,
    );
  });

  it('bounds errored runs separately, so an outage never hides a semantic failure', () => {
    const message = ReportHarness.renderedVerdict(
      [
        ...ReportHarness.runs(RunCount.Smaller, 'errored'),
        ...ReportHarness.runs(1, 'failed', ClaimText.Default),
      ],
      Threshold.Certain,
    );
    expect(message).toContain(`${ReportText.FailedRun} Run #${RunCount.Smaller + 1}`);
    expect(message).toContain(`${ReportText.ErroredRun} Run #${ReportBound.FullSections}`);
    expect(message).not.toContain(`${ReportText.ErroredRun} Run #${ReportBound.FullSections + 1}`);
    expect(message).toContain(
      `+ ${RunCount.Smaller - ReportBound.FullSections} more errored run(s) not shown in full`,
    );
  });

  it('tallies the first failing claim of every failed run when some are not shown in full', () => {
    const message = ReportHarness.renderedVerdict(
      [
        ...ReportHarness.runs(RunCount.Smaller, 'failed', ClaimText.OnTopic),
        ...ReportHarness.runs(1, 'failed', ClaimText.NamesPrice),
      ],
      Threshold.Certain,
    );
    expect(message).toContain(
      `${RunCount.Smaller} run(s): ${AssertionName.Coherent} "${ClaimText.OnTopic}"`,
    );
    expect(message).toContain(`1 run(s): ${AssertionName.Coherent} "${ClaimText.NamesPrice}"`);
  });

  it('adds no tally when every failed run is shown in full', () => {
    const message = ReportHarness.renderedVerdict(
      ReportHarness.runs(ReportBound.FullSections, 'failed', ClaimText.OnTopic),
      Threshold.Certain,
    );
    expect(message).not.toContain(ReportText.TallyHeader);
  });

  it('heads the tally with the number of failed runs it covers', () => {
    const message = ReportHarness.renderedVerdict(
      ReportHarness.runs(RunCount.Smaller, 'failed', ClaimText.OnTopic),
      Threshold.Certain,
    );
    expect(message).toContain(`${ReportText.TallyHeader} ${RunCount.Smaller} failed runs):`);
  });

  it('tallies runs whose first failure was a judge error or a bare throw by that kind', () => {
    const judgeError = { cause: new Error(ProviderFault.InvalidKey), attempts: 1, seq: 0 };
    const message = ReportHarness.renderedVerdict(
      [
        ...ReportHarness.runs(RunCount.Smaller, 'failed'),
        ReportHarness.run('failed', new Error(ProviderFault.InvalidKey), [], [judgeError]),
      ],
      Threshold.Certain,
    );
    expect(message).toContain(`${RunCount.Smaller} run(s): ${ReportText.ThrownOnlyLabel}`);
    expect(message).toContain(`1 run(s): ${ReportText.JudgeErroredLabel}`);
  });
});

describe('Reporter — full verbosity', () => {
  it('renders every failed run in full, beyond the default three-run bound', () => {
    const message = ReportHarness.renderedVerdict(
      ReportHarness.runs(RunCount.Smaller, 'failed', ClaimText.Default),
      Threshold.Certain,
      ReportHarness.fullReporter(),
    );
    expect(message).toContain(`${ReportText.FailedRun} Run #${RunCount.Smaller}`);
    expect(message).not.toContain(ReportText.NotShownInFull);
    expect(message).not.toContain(ReportText.TallyHeader);
  });

  it('renders every errored run in full, beyond the default three-run bound', () => {
    const message = ReportHarness.renderedVerdict(
      ReportHarness.runs(RunCount.Smaller, 'errored'),
      Threshold.Certain,
      ReportHarness.fullReporter(),
    );
    expect(message).toContain(`${ReportText.ErroredRun} Run #${RunCount.Smaller}`);
    expect(message).not.toContain(ReportText.NotShownInFull);
  });

  it('renders passed runs with their passing verdicts, claim and judge reasoning', () => {
    const message = ReportHarness.renderedVerdict(
      [
        ReportHarness.run('passed', undefined, [
          ReportHarness.trueVerdict({
            claim: ClaimText.KeepsSecret,
            reasoning: 'the reply never mentions the secret',
          }),
        ]),
        ReportHarness.run('failed', new Error('miss'), [ReportHarness.falseVerdict()]),
      ],
      Threshold.Certain,
      ReportHarness.fullReporter(),
    );
    expect(message).toContain(`${ReportText.PassedRun} Run #1`);
    expect(message).toContain(ClaimText.KeepsSecret);
    expect(message).toContain('the reply never mentions the secret');
  });

  it('lists every judge record of a run in the order it was recorded', () => {
    const judgeError = { cause: new Error(ProviderFault.InvalidKey), attempts: 3, seq: 1 };
    const message = ReportHarness.renderedVerdict(
      [
        ReportHarness.run(
          'failed',
          new Error('miss'),
          [
            ReportHarness.falseVerdict({ claim: ClaimText.NamesPrice, seq: 2 }),
            ReportHarness.trueVerdict({ claim: ClaimText.KeepsSecret, seq: 0 }),
          ],
          [judgeError],
        ),
      ],
      Threshold.Certain,
      ReportHarness.fullReporter(),
    );
    const passing = message.lastIndexOf(ClaimText.KeepsSecret);
    const errored = message.lastIndexOf(ProviderFault.InvalidKey);
    const failing = message.lastIndexOf(ClaimText.NamesPrice);
    expect(passing).toBeGreaterThan(-1);
    expect(errored).toBeGreaterThan(passing);
    expect(failing).toBeGreaterThan(errored);
  });

  it('states how many attempts a judge call took before it errored', () => {
    const message = ReportHarness.renderedVerdict(
      [
        ReportHarness.run(
          'failed',
          new Error('miss'),
          [],
          [{ cause: new Error(ProviderFault.InvalidKey), attempts: 3, seq: 0 }],
        ),
      ],
      Threshold.Certain,
      ReportHarness.fullReporter(),
    );
    expect(message).toContain(ReportText.JudgeCallErrored);
  });

  it('renders every run of an expired test, beyond the default bound', () => {
    const message = ReportHarness.renderedExpiry(
      ReportHarness.runs(RunCount.Smaller, 'discarded'),
      TimeoutBudget.SmokeMs,
      ReportHarness.fullReporter(),
    );
    expect(message).toContain(`${ReportText.DiscardedRun} Run #${RunCount.Smaller}`);
  });

  it('states when a run recorded no judge calls', () => {
    const message = ReportHarness.renderedVerdict(
      [ReportHarness.run('failed', new Error('thrown before judging'))],
      Threshold.Certain,
      ReportHarness.fullReporter(),
    );
    expect(message).toContain(ReportText.NoJudgeCalls);
  });

  it('renders discarded runs one by one with the judge output they produced', () => {
    const message = ReportHarness.renderedFullAbort([
      ReportHarness.run('errored', new CrucibleError('infra', ProviderFault.InvalidKey)),
      ReportHarness.run('discarded', undefined, [
        ReportHarness.trueVerdict({ claim: ClaimText.KeepsSecret }),
      ]),
    ]);
    expect(message).toContain(`${ReportText.DiscardedRun} Run #2`);
    expect(message).toContain(ClaimText.KeepsSecret);
  });

  it('keeps the response excerpt bounded', () => {
    const response = 'v'.repeat(ExcerptChars.Default + 1);
    const message = ReportHarness.renderedVerdict(
      [ReportHarness.run('passed', undefined, [ReportHarness.trueVerdict({ response })])],
      Threshold.Half,
      ReportHarness.fullReporter(),
    );
    expect(message).not.toContain(response);
    expect(message).toContain('v'.repeat(ExcerptChars.Default) + '…');
  });

  it('default verbosity never renders passed runs or passing verdicts', () => {
    const message = ReportHarness.renderedVerdict(
      [
        ReportHarness.run('passed', undefined, [
          ReportHarness.trueVerdict({ claim: ClaimText.KeepsSecret }),
        ]),
        ReportHarness.run('failed', new Error('miss'), [ReportHarness.falseVerdict()]),
      ],
      Threshold.Certain,
    );
    expect(message).not.toContain(ReportText.PassedRun);
    expect(message).not.toContain(ClaimText.KeepsSecret);
  });
});

describe('Reporter — passing report', () => {
  it('headlines a passing gate with its pass rate against the threshold', () => {
    const message = ReportHarness.renderedPass(
      ReportHarness.runs(RunCount.Smaller, 'passed'),
      Threshold.Half,
    );
    expect(message.split('\n')[0]).toContain(ReportText.Passed);
    expect(message.split('\n')[0]).toContain(`${RunCount.Smaller}/${RunCount.Smaller} runs passed`);
  });

  it('headlines a passing smoke run without a pass-rate count', () => {
    const message = ReportHarness.renderedPass(ReportHarness.runs(1, 'passed'), Threshold.Certain);
    expect(message.split('\n')[0]).toContain(`${ReportText.Passed} ${ReportText.Smoke}`);
    expect(message).not.toContain(ReportText.Counts);
  });

  it('renders every passed run with its judge output', () => {
    const message = ReportHarness.renderedPass(
      ReportHarness.claimedRuns('passed', [ClaimText.KeepsSecret, ClaimText.NamesPrice]),
      Threshold.Certain,
    );
    expect(message).toContain(`${ReportText.PassedRun} Run #2`);
    expect(message).toContain(ClaimText.NamesPrice);
  });
});
