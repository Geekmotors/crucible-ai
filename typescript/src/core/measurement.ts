type SuggestedGate = {
  readonly runs: number;
  readonly need: number;
  readonly threshold: number;
  readonly drop?: number;
  readonly caught?: number;
};

type SettledCounts = {
  readonly passed: number;
  readonly failed: number;
  readonly errored: number;
};

type Measurement =
  | (SettledCounts & { readonly outcome: 'errored'; readonly settled: 0 })
  | (SettledCounts & {
      readonly outcome: 'measured';
      readonly settled: number;
      readonly rate: number;
      readonly low: number;
      readonly high: number;
      readonly need: number;
      readonly meetsTarget: boolean;
      readonly suggestion: SuggestedGate | null;
      readonly sharper: SuggestedGate | null;
    });

type AssertionCount = {
  readonly claim: string;
  readonly passed: number;
  readonly evaluated: number;
};

type LikelyRange = { readonly low: number; readonly high: number };

export type { AssertionCount, LikelyRange, Measurement, SettledCounts, SuggestedGate };
