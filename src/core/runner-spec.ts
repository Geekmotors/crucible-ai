import type { GatedTest } from './gate.js';
import type { GroupCallback } from './group-settings.js';

type VariantCall = 'register' | 'passthrough' | 'table';

type ForwardedArguments = 'all' | 'none' | 'first';

type VariantNode = {
  readonly call: VariantCall;
  readonly variants: Readonly<Record<string, VariantNode>>;
  readonly forward?: ForwardedArguments;
  readonly returns?: VariantNode;
};

type RunnerFamily = {
  readonly subject: string;
  readonly locate: () => unknown;
  readonly node: VariantNode;
  readonly blocked: Readonly<Record<string, string>>;
};

type GroupPath = () => readonly object[];

type RunnerSpec = {
  readonly test: RunnerFamily;
  readonly group: RunnerFamily;
  readonly testArguments: (name: unknown, test: GatedTest, timeout: number) => unknown[];
  readonly groupArguments: (name: unknown, callback: GroupCallback) => unknown[];
  readonly groupPath?: GroupPath;
};

export type { ForwardedArguments, GroupPath, RunnerFamily, RunnerSpec, VariantCall, VariantNode };
