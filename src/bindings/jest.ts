import { BlockedReason } from '../core/blocked-reason.enum.js';
import { CrucibleError } from '../core/errors.js';
import type { GatedTest } from '../core/gate.js';
import type { GroupCallback } from '../core/group-settings.js';
import type { RunnerSpec, VariantNode } from '../core/runner-spec.js';

class JestBinding {
  private static readonly TABLE: VariantNode = { call: 'table', variants: {} };
  private static readonly FOCUS: VariantNode = {
    call: 'register',
    variants: { each: JestBinding.TABLE },
  };
  private static readonly TEST: VariantNode = {
    call: 'register',
    variants: {
      only: JestBinding.FOCUS,
      skip: JestBinding.FOCUS,
      todo: { call: 'passthrough', variants: {} },
      each: JestBinding.TABLE,
    },
  };
  private static readonly GROUP: VariantNode = {
    call: 'register',
    variants: { only: JestBinding.FOCUS, skip: JestBinding.FOCUS, each: JestBinding.TABLE },
  };
  private static readonly BLOCKED: Readonly<Record<string, string>> = {
    failing: BlockedReason.InvertedOutcome,
    concurrent: BlockedReason.ConcurrentTests,
  };

  constructor(private readonly globals: object = globalThis) {}

  spec(): RunnerSpec {
    return {
      test: {
        subject: 'crucible.it',
        locate: () => this.global('it', 'crucible.it'),
        node: JestBinding.TEST,
        blocked: JestBinding.BLOCKED,
      },
      group: {
        subject: 'crucible.describe',
        locate: () => this.global('describe', 'crucible.describe'),
        node: JestBinding.GROUP,
        blocked: {},
      },
      testArguments: JestBinding.testArguments,
      groupArguments: JestBinding.groupArguments,
    };
  }

  private global(name: string, subject: string): unknown {
    const registrar = (this.globals as Record<string, unknown>)[name];
    if (typeof registrar !== 'function') {
      throw new CrucibleError(
        'usage',
        `${subject} needs Jest with injected globals: no callable global "${name}" was found ` +
          '(injectGlobals: false is not supported in v1).',
      );
    }
    return registrar;
  }

  private static testArguments(name: unknown, test: GatedTest, timeout: number): unknown[] {
    return [name, test, timeout];
  }

  private static groupArguments(name: unknown, callback: GroupCallback): unknown[] {
    return [name, callback];
  }
}

export { JestBinding };
