import type { RunGate } from './run-options.js';
import type { Measurement } from './measurement.js';
import type { RunLedger } from './state.js';

type RunStatus = 'passed' | 'failed' | 'errored' | 'discarded';

type RunResult = {
  readonly status: RunStatus;
  readonly cause?: unknown;
  readonly context: RunLedger;
};

type VerdictZone = 'pass' | 'fail' | 'errored';

type RunTally = {
  readonly zone: VerdictZone;
  readonly need: number;
  readonly passed: number;
  readonly failed: number;
  readonly errored: number;
};

type VerdictSummary = {
  readonly results: readonly RunResult[];
  readonly tally: RunTally;
  readonly options: RunGate;
};

type AbortSummary = Omit<VerdictSummary, 'tally'>;

type FatalSummary = AbortSummary & {
  readonly fatal: unknown;
};

type ExpirySummary = AbortSummary & {
  readonly deadlineMs: number;
};

type MeasuredSummary = AbortSummary & {
  readonly measurement: Measurement;
  readonly gateRuns: number;
  readonly name?: string;
};

export type {
  AbortSummary,
  ExpirySummary,
  FatalSummary,
  MeasuredSummary,
  RunResult,
  RunStatus,
  RunTally,
  VerdictSummary,
  VerdictZone,
};
