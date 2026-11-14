type RunOptions = {
  readonly runs?: number;
  readonly threshold?: number;
  readonly inferenceTimeout?: number;
  readonly testTimeout?: number;
  readonly strict?: boolean;
};

type RunGate = {
  readonly runs: number;
  readonly threshold: number;
};

type ResolvedRunOptions = RunGate & {
  readonly inferenceTimeout: number;
  readonly testTimeout: number;
  readonly strict: boolean;
};

export type { ResolvedRunOptions, RunGate, RunOptions };
