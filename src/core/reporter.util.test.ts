import { describe, expect, it } from '@jest/globals';
import { CrucibleError } from './errors.js';
import { Reporter } from './reporter.util.js';
import { ProviderFault } from './test/provider-fault.enum.js';
import { Threshold } from './test/threshold.enum.js';
import { ReportHarness } from './test/report-harness.util.js';

const EXCERPT_LIMIT = 500;

describe('Reporter', () => {
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

  it('also names the thrown failure so an unrelated crash is never hidden by a verdict', () => {
    const message = ReportHarness.renderedFailure(
      [ReportHarness.falseVerdict()],
      new TypeError('cannot read x of undefined'),
    );
    expect(message).toContain('cannot read x of undefined');
  });

  it('truncates a long response to 500 characters and marks the cut', () => {
    const response = 'x'.repeat(EXCERPT_LIMIT + 100);
    const message = ReportHarness.renderedFailure([ReportHarness.falseVerdict({ response })]);
    expect(message).toContain('x'.repeat(EXCERPT_LIMIT) + '…');
    expect(message).not.toContain('x'.repeat(EXCERPT_LIMIT + 1));
  });

  it('renders a response at the 500-character limit whole, without a truncation marker', () => {
    const response = 'y'.repeat(EXCERPT_LIMIT);
    const message = ReportHarness.renderedFailure([ReportHarness.falseVerdict({ response })]);
    expect(message).toContain(response);
    expect(message).not.toContain('…');
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

  it('renders an errored run as errored, not failed, and names the infrastructure cause', () => {
    const cause = new CrucibleError('infra', 'provider unreachable');
    const message = new Reporter().renderErrored(ReportHarness.context(), cause);
    expect(message).toMatch(/errored/i);
    expect(message).toMatch(/not failed/i);
    expect(message).toContain('provider unreachable');
  });

  it('names the terminal rejection and the recorded attempt count for an errored run', () => {
    const rejection = new CrucibleError('infra', 'kept failing after 3 attempts');
    const message = new Reporter().renderErrored(
      ReportHarness.context(
        [],
        [
          { cause: new Error('second outage'), attempts: 1, seq: 3 },
          { cause: new Error('first outage'), attempts: 2, seq: 1 },
        ],
      ),
      rejection,
    );
    expect(message).toContain('kept failing after 3 attempts');
    expect(message).toContain('2');
  });

  it('keeps failed-run wording free of the errored-run marker', () => {
    const failed = ReportHarness.renderedFailure([ReportHarness.falseVerdict()]);
    expect(failed).not.toMatch(/not failed/i);
  });

  it('headlines the pass rate with passed count, run count, need, and threshold', () => {
    const message = ReportHarness.renderedVerdict(
      [
        ReportHarness.run('passed'),
        ReportHarness.run('failed', new Error('first miss')),
        ReportHarness.run('failed', new Error('second miss')),
      ],
      Threshold.Half,
    );
    expect(message).toContain('1/3');
    expect(message).toContain('need 2');
    expect(message).toContain(String(Threshold.Half));
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
    expect(message).toMatch(/not failed/i);
    expect(message).toContain('provider unreachable');
    expect(message).toContain('rate limited');
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

  it('keeps a failing verdict free of the errored-run marker', () => {
    const message = ReportHarness.renderedVerdict(
      [ReportHarness.run('failed', new Error('the miss'))],
      Threshold.Certain,
    );
    expect(message).not.toMatch(/not failed/i);
  });

  it('headlines an aborted test as aborted and names the fatal cause', () => {
    const message = ReportHarness.renderedAbort(
      [
        ReportHarness.run('errored', new CrucibleError('infra', ProviderFault.InvalidKey)),
        ReportHarness.run('discarded'),
      ],
      Threshold.Certain,
    );
    expect(message).toMatch(/aborted/i);
    expect(message).toContain(ProviderFault.InvalidKey);
  });

  it('renders runs aborted in flight as discarded, never as failed', () => {
    const message = ReportHarness.renderedAbort(
      [
        ReportHarness.run('errored', new CrucibleError('infra', ProviderFault.InvalidKey)),
        ReportHarness.run('discarded'),
        ReportHarness.run('discarded'),
      ],
      Threshold.Certain,
    );
    expect(message).toMatch(/discarded/i);
    expect(message).toContain('Run #2');
    expect(message).toContain('Run #3');
    expect(message).not.toMatch(/Run failed/);
  });

  it('keeps a run settled before the abort under its own status', () => {
    const message = ReportHarness.renderedAbort(
      [
        ReportHarness.run('failed', new Error('settled miss')),
        ReportHarness.run('errored', new CrucibleError('infra', ProviderFault.InvalidKey)),
        ReportHarness.run('discarded'),
      ],
      Threshold.Certain,
    );
    expect(message).toContain('Run #1 (failed)');
    expect(message).toContain('settled miss');
  });

  it('never renders a discarded run as a failed section in a verdict report', () => {
    const message = ReportHarness.renderedVerdict(
      [ReportHarness.run('passed'), ReportHarness.run('discarded')],
      Threshold.Certain,
    );
    expect(message).toMatch(/discarded/i);
    expect(message).not.toMatch(/Run failed/);
  });
});
