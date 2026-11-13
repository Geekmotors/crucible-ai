import { describe, expect, it } from '@jest/globals';
import { CustomTimeout } from './test/custom-timeout.enum.js';
import { InvalidTimeout } from './test/invalid-timeout.enum.js';
import { RunCount } from './test/run-count.enum.js';
import { TimeoutBudget } from './test/timeout-budget.enum.js';
import { TimeBudget } from './time-budget.util.js';

describe('TimeBudget', () => {
  it('keeps the 30 second smoke budget for a single run', () => {
    expect(TimeBudget.testTimeoutFor(RunCount.Single)).toBe(TimeoutBudget.SmokeMs);
  });

  it('adds one second per extra run', () => {
    expect(TimeBudget.testTimeoutFor(RunCount.Gated)).toBe(
      TimeoutBudget.SmokeMs + (RunCount.Gated - 1) * TimeoutBudget.PerExtraRunMs,
    );
  });

  it('never sizes the test deadline beyond what a timer can hold', () => {
    expect(TimeBudget.testTimeoutFor(RunCount.BeyondTimerMax)).toBe(TimeoutBudget.TimerMaxMs);
  });

  it('never shrinks the per-test budget as the run count grows', () => {
    const budgets = Array.from({ length: RunCount.Gated }, (_, index) =>
      TimeBudget.testTimeoutFor(index + 1),
    );
    expect(budgets).toEqual([...budgets].sort((a, b) => a - b));
  });

  it.each([CustomTimeout.Short, TimeoutBudget.TimerMaxMs])('accepts %d ms', (ms) => {
    expect(TimeBudget.isValidTimeout(ms)).toBe(true);
  });

  it.each([
    InvalidTimeout.Zero,
    InvalidTimeout.Negative,
    InvalidTimeout.Fractional,
    InvalidTimeout.AboveTimerMax,
    Number.NaN,
    String(CustomTimeout.Short),
  ])('refuses %p as a timeout', (ms) => {
    expect(TimeBudget.isValidTimeout(ms)).toBe(false);
  });
});
