type RunOptions = {
  readonly runs?: number;
  readonly threshold?: number;
  readonly inferenceTimeout?: number;
  readonly testTimeout?: number;
  readonly strict?: boolean;
  readonly measure?: boolean;
};

type Invocation = {
  readonly mode?: 'measure';
  readonly measureRuns?: number;
};

type RunGate = {
  readonly runs: number;
  readonly threshold: number;
};

type ResolvedRunOptions = RunGate & {
  readonly inferenceTimeout: number;
  readonly testTimeout: number;
  readonly strict: boolean;
  readonly measure: boolean;
  readonly measureRuns?: number;
};

export type { Invocation, ResolvedRunOptions, RunGate, RunOptions };
