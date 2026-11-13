import { describe, expect, it } from '@jest/globals';
import { Aggregator } from './aggregator.util.js';
import type { RunStatus } from './run-result.js';
import { RunCount } from './test/run-count.enum.js';
import { Threshold } from './test/threshold.enum.js';
import { StatusMix } from './test/status-mix.util.js';

describe('Aggregator', () => {
  it.each<[string, RunStatus[], number, string]>([
    [
      '7 of 20 at 0.35 passes',
      StatusMix.of(RunCount.LenientNeed, 0, RunCount.Gated - RunCount.LenientNeed),
      Threshold.Lenient,
      'pass',
    ],
    [
      '6 of 20 at 0.35 fails',
      StatusMix.of(RunCount.LenientNeed - 1, 0, RunCount.Gated - RunCount.LenientNeed + 1),
      Threshold.Lenient,
      'fail',
    ],
    [
      '19 of 20 at 0.95 passes',
      StatusMix.of(RunCount.StrictNeed, 0, RunCount.Gated - RunCount.StrictNeed),
      Threshold.Strict,
      'pass',
    ],
    [
      '18 passed + 1 errored of 20 at 0.95 is errored',
      StatusMix.of(RunCount.StrictNeed - 1, 1, 1),
      Threshold.Strict,
      'errored',
    ],
    [
      '18 passed + 2 failed of 20 at 0.95 fails',
      StatusMix.of(RunCount.StrictNeed - 1, 0, 2),
      Threshold.Strict,
      'fail',
    ],
    ['a single passed run at 1.0 passes', ['passed'], Threshold.Certain, 'pass'],
    ['a single failed run at 1.0 fails', ['failed'], Threshold.Certain, 'fail'],
    ['a single errored run at 1.0 is errored', ['errored'], Threshold.Certain, 'errored'],
    [
      '1 passed + 1 errored + 1 failed of 3 at 0.5 is errored',
      ['passed', 'errored', 'failed'],
      Threshold.Half,
      'errored',
    ],
  ])('%s', (_label, statuses, threshold, zone) => {
    expect(new Aggregator().tally(statuses, { runs: statuses.length, threshold }).zone).toBe(zone);
  });

  it.each([
    [RunCount.Gated, Threshold.Lenient, RunCount.LenientNeed],
    [RunCount.Gated, Threshold.Strict, RunCount.StrictNeed],
    [RunCount.Single, Threshold.Certain, RunCount.Single],
  ])('%i runs at threshold %p need exactly %i passes', (runs, threshold, need) => {
    expect(new Aggregator().tally(StatusMix.of(runs, 0, 0), { runs, threshold }).need).toBe(need);
  });

  it('counts passed, failed and errored runs', () => {
    const statuses: RunStatus[] = ['passed', 'errored', 'failed', 'failed'];
    const tally = new Aggregator().tally(statuses, {
      runs: statuses.length,
      threshold: Threshold.Half,
    });
    expect([tally.passed, tally.errored, tally.failed]).toEqual([1, 1, 2]);
  });
});
