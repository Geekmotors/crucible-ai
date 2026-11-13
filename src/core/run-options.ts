type RunOptions = {
  readonly runs?: number;
  readonly threshold?: number;
};

type ResolvedRunOptions = {
  readonly runs: number;
  readonly threshold: number;
};

export type { ResolvedRunOptions, RunOptions };
