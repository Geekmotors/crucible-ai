import { describe, expect, it } from '@jest/globals';
import { CrucibleError } from './errors.js';
import { AssertionName } from './test/assertion-name.enum.js';
import { ExcerptChars } from './test/excerpt-chars.enum.js';
import { ProviderFault } from './test/provider-fault.enum.js';
import { ReportBound } from './test/report-bound.enum.js';
import { ReportHarness } from './test/report-harness.util.js';
import { ReportText } from './test/report-text.enum.js';
import { RunCount } from './test/run-count.enum.js';
import { Threshold } from './test/threshold.enum.js';
import { TimeoutBudget } from './test/timeout-budget.enum.js';

const EXCERPT_LIMIT = ExcerptChars.Default;

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
    const response = 'x'.repeat(EXCERPT_LIMIT + 100);
    const message = ReportHarness.renderedFailure([ReportHarness.falseVerdict({ response })]);
    expect(message).toContain('x'.repeat(EXCERPT_LIMIT) + '…');
    expect(message).not.toContain('x'.repeat(EXCERPT_LIMIT + 1));
    expect(message).toContain(String(EXCERPT_LIMIT + 100));
  });

  it('renders a response at the 500-character limit whole, without a truncation marker', () => {
    const response = 'y'.repeat(EXCERPT_LIMIT);
    const message = ReportHarness.renderedFailure([ReportHarness.falseVerdict({ response })]);
    expect(message).toContain(response);
    expect(message).not.toContain('…');
  });

  it('cuts the excerpt at the configured length', () => {
    const response = 'w'.repeat(EXCERPT_LIMIT);
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
    const response = 'z'.repeat(EXCERPT_LIMIT - 1) + '😀' + 'tail';
    const message = ReportHarness.renderedFailure([ReportHarness.falseVerdict({ response })]);
    expect(message).not.toMatch(/[\uD800-\uDBFF]…/);
    expect(message).toContain('…');
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

  it('marks a failed run with the failed marker, never the errored one', () => {
    const message = ReportHarness.renderedFailure([ReportHarness.falseVerdict()]);
    expect(message).toContain(`${ReportText.FailedRun} Run #1`);
    expect(message).not.toContain(ReportText.ErroredRun);
    expect(message).not.toMatch(/not failed/i);
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

  it('marks an inconclusive verdict as errored, not failed, naming every errored run cause', () => {
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
      ReportHarness.runs(RunCount.Gated, 'failed', 'the claim'),
      Threshold.Certain,
    );
    expect(message).toContain(`${ReportText.FailedRun} Run #${ReportBound.FullSections}`);
    expect(message).not.toContain(`${ReportText.FailedRun} Run #${ReportBound.FullSections + 1}`);
  });

  it('lists the failed runs not shown in full as a compressed range', () => {
    const message = ReportHarness.renderedVerdict(
      ReportHarness.runs(RunCount.Gated, 'failed', 'the claim'),
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
        ...ReportHarness.runs(1, 'failed', 'the claim'),
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
        ...ReportHarness.runs(RunCount.Smaller, 'failed', 'stays on topic'),
        ...ReportHarness.runs(1, 'failed', 'names the price'),
      ],
      Threshold.Certain,
    );
    expect(message).toContain(
      `${RunCount.Smaller} run(s): ${AssertionName.Coherent} "stays on topic"`,
    );
    expect(message).toContain(`1 run(s): ${AssertionName.Coherent} "names the price"`);
  });

  it('adds no tally when every failed run is shown in full', () => {
    const message = ReportHarness.renderedVerdict(
      ReportHarness.runs(ReportBound.FullSections, 'failed', 'stays on topic'),
      Threshold.Certain,
    );
    expect(message).not.toContain('run(s): ');
  });
});
