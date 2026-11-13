type RunOptions = {
  readonly runs?: number;
  readonly threshold?: number;
  readonly inferenceTimeout?: number;
  readonly testTimeout?: number;
};

type RunGate = {
  readonly runs: number;
  readonly threshold: number;
};

type ResolvedRunOptions = RunGate & {
  readonly inferenceTimeout: number;
  readonly testTimeout: number;
};

export type { ResolvedRunOptions, RunGate, RunOptions };
