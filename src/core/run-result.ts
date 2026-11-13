import type { ResolvedRunOptions } from './run-options.js';
import type { RunContext } from './state.js';

type RunStatus = 'passed' | 'failed' | 'errored' | 'discarded';

type RunResult = {
  readonly status: RunStatus;
  readonly cause?: unknown;
  readonly context: RunContext;
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
  readonly options: ResolvedRunOptions;
};

type AbortSummary = Omit<VerdictSummary, 'tally'>;

type ExpirySummary = AbortSummary & {
  readonly deadlineMs: number;
};

export type {
  AbortSummary,
  ExpirySummary,
  RunResult,
  RunStatus,
  RunTally,
  VerdictSummary,
  VerdictZone,
};
