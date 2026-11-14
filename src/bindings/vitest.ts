import { BlockedReason } from '../core/blocked-reason.enum.js';
import type { GatedTest } from '../core/gate.js';
import type { GroupCallback } from '../core/group-settings.js';
import type { ForwardedArguments, RunnerSpec, VariantNode } from '../core/runner-spec.js';

type VitestSource = {
  readonly test?: unknown;
  readonly describe?: unknown;
  readonly currentGroup: () => unknown;
};

class VitestBinding {
  private static readonly MODIFIERS = ['only', 'skip'];
  private static readonly CONDITIONS = ['skipIf', 'runIf'];
  private static readonly PASSTHROUGH: VariantNode = { call: 'passthrough', variants: {} };
  private static readonly TEST = VitestBinding.family('none', { each: 'all', for: 'first' });
  private static readonly GROUP = VitestBinding.family('none', { each: 'all', for: 'all' });
  private static readonly TEST_BLOCKED: Readonly<Record<string, string>> = {
    fails: BlockedReason.InvertedOutcome,
    concurrent: BlockedReason.ConcurrentTests,
  };
  private static readonly GROUP_BLOCKED: Readonly<Record<string, string>> = {
    concurrent: BlockedReason.GroupScheduling,
    shuffle: BlockedReason.GroupScheduling,
    sequential: BlockedReason.GroupScheduling,
  };

  constructor(private readonly source: VitestSource) {}

  spec(): RunnerSpec {
    return {
      test: {
        subject: 'crucible.it',
        locate: () => this.source.test,
        node: VitestBinding.TEST,
        blocked: VitestBinding.TEST_BLOCKED,
      },
      group: {
        subject: 'crucible.describe',
        locate: () => this.source.describe,
        node: VitestBinding.GROUP,
        blocked: VitestBinding.GROUP_BLOCKED,
      },
      testArguments: VitestBinding.testArguments,
      groupArguments: VitestBinding.groupArguments,
      groupPath: () => this.groupPath(),
    };
  }

  private groupPath(): readonly object[] {
    const path: object[] = [];
    for (
      let group = VitestBinding.parentOf(this.currentGroup());
      group !== undefined;
      group = VitestBinding.parentOf(group)
    ) {
      path.unshift(group);
    }
    return path;
  }

  private currentGroup(): unknown {
    try {
      return this.source.currentGroup();
    } catch {
      return undefined;
    }
  }

  private static parentOf(node: unknown): object | undefined {
    if (typeof node !== 'object' || node === null) {
      return undefined;
    }
    const parent: unknown = Reflect.get(node, 'suite');
    return typeof parent === 'object' && parent !== null ? parent : undefined;
  }

  private static family(
    forward: ForwardedArguments,
    tables: Readonly<Record<string, ForwardedArguments>>,
  ): VariantNode {
    const tableNodes = Object.fromEntries(
      Object.entries(tables).map(([name, rows]) => [name, VitestBinding.table(rows)]),
    );
    const registrar: VariantNode = { call: 'register', variants: {}, forward };
    const modifiers = VitestBinding.MODIFIERS.map((name) => [
      name,
      { call: 'register', variants: tableNodes, forward },
    ]);
    const conditions = VitestBinding.CONDITIONS.map((name) => [
      name,
      { call: 'table', variants: {}, returns: registrar },
    ]);
    return {
      call: 'register',
      forward,
      variants: {
        ...Object.fromEntries([...modifiers, ...conditions]),
        ...tableNodes,
        todo: VitestBinding.PASSTHROUGH,
      },
    };
  }

  private static table(forward: ForwardedArguments): VariantNode {
    return { call: 'table', variants: {}, returns: { call: 'register', variants: {}, forward } };
  }

  private static testArguments(name: unknown, test: GatedTest, timeout: number): unknown[] {
    return [name, { timeout, concurrent: false }, test];
  }

  private static groupArguments(name: unknown, callback: GroupCallback): unknown[] {
    return [name, { concurrent: false, shuffle: false }, callback];
  }
}

export { VitestBinding };
export type { VitestSource };
