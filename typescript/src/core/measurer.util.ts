import { Binomial } from './binomial.util.js';
import type { AssertionCount, LikelyRange, Measurement, SuggestedGate } from './measurement.js';
import type { RunStatus } from './run-result.js';

type ClaimVerdict = { readonly claim: string; readonly verdict: boolean };

type MeasuredRun = { readonly status: RunStatus; readonly verdicts: readonly ClaimVerdict[] };

class Measurer {
  static readonly SHARPER_RUNS = 50;
  private static readonly RANGE_TAIL = 0.025;
  private static readonly PLANNING_TAIL = 0.2;
  private static readonly FALSE_RED = 0.05;
  private static readonly DROP = 0.1;
  private static readonly EPSILON = 1e-9;
  private static readonly MIN_DECIMALS = 2;

  measure(statuses: readonly RunStatus[], threshold: number, gateRuns: number): Measurement {
    const passed = Measurer.count(statuses, 'passed');
    const failed = Measurer.count(statuses, 'failed');
    const errored = Measurer.count(statuses, 'errored');
    const settled = passed + failed;
    if (settled === 0) {
      return { outcome: 'errored', passed, failed, errored, settled };
    }
    const need = Measurer.need(threshold, settled);
    const planning = Measurer.planningRate(passed, settled);
    return {
      outcome: 'measured',
      passed,
      failed,
      errored,
      settled,
      rate: Measurer.rate(passed, settled),
      ...this.range(passed, settled),
      need,
      meetsTarget: passed >= need,
      suggestion: Measurer.gate(planning, gateRuns, passed, settled),
      sharper:
        gateRuns < Measurer.SHARPER_RUNS
          ? Measurer.gate(planning, Measurer.SHARPER_RUNS, passed, settled)
          : null,
    };
  }

  range(passed: number, settled: number): LikelyRange {
    const low =
      passed === 0
        ? 0
        : Binomial.rising((p) => Binomial.atLeast(passed, settled, p), Measurer.RANGE_TAIL);
    const high =
      passed === settled
        ? 1
        : Binomial.falling((p) => Binomial.atMost(passed, settled, p), Measurer.RANGE_TAIL);
    return { low: Math.floor(low * 100) / 100, high: Math.ceil(high * 100) / 100 };
  }

  byAssertion(runs: readonly MeasuredRun[]): AssertionCount[] {
    const counts = new Map<string, { passed: number; evaluated: number }>();
    for (const run of runs) {
      if (run.status !== 'passed' && run.status !== 'failed') {
        continue;
      }
      for (const { claim, verdict } of run.verdicts) {
        const count = counts.get(claim) ?? { passed: 0, evaluated: 0 };
        counts.set(claim, {
          passed: count.passed + (verdict ? 1 : 0),
          evaluated: count.evaluated + 1,
        });
      }
    }
    return [...counts].map(([claim, count]) => ({ claim, ...count }));
  }

  static rate(passed: number, settled: number): number {
    return Measurer.floorTo(passed / settled, 3);
  }

  private static gate(
    planning: number,
    runs: number,
    passed: number,
    settled: number,
  ): SuggestedGate | null {
    const need = Measurer.largestSafeNeed(planning, runs);
    if (need === 0) {
      return null;
    }
    const gate = { runs, need, threshold: Measurer.thresholdFor(need, runs) };
    const drop = Measurer.floorTo(passed / settled - Measurer.DROP, 3);
    if (drop <= 0) {
      return gate;
    }
    return { ...gate, drop, caught: Math.round(Binomial.below(need, runs, drop) * 100) };
  }

  private static largestSafeNeed(planning: number, runs: number): number {
    let need = 0;
    while (need < runs && Binomial.below(need + 1, runs, planning) <= Measurer.FALSE_RED) {
      need += 1;
    }
    return need;
  }

  private static thresholdFor(need: number, runs: number): number {
    for (let decimals = Measurer.MIN_DECIMALS; ; decimals += 1) {
      const threshold = Measurer.floorTo(need / runs, decimals);
      if (Measurer.need(threshold, runs) === need) {
        return threshold;
      }
    }
  }

  private static planningRate(passed: number, settled: number): number {
    if (passed === 0) {
      return 0;
    }
    return Binomial.rising((p) => Binomial.atLeast(passed, settled, p), Measurer.PLANNING_TAIL);
  }

  private static need(threshold: number, runs: number): number {
    return Math.max(1, Math.ceil(threshold * runs - Measurer.EPSILON));
  }

  private static floorTo(value: number, decimals: number): number {
    const scale = 10 ** decimals;
    return Math.floor(value * scale + Measurer.EPSILON) / scale;
  }

  private static count(statuses: readonly RunStatus[], status: RunStatus): number {
    return statuses.filter((candidate) => candidate === status).length;
  }
}

export { Measurer };
export type { ClaimVerdict, MeasuredRun };
