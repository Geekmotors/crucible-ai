import { BlockedReason } from '../blocked-reason.enum.js';
import type { GatedTest } from '../gate.js';
import type { GroupCallback } from '../group-settings.js';
import type { RunnerSpec, VariantNode } from '../runner-spec.js';
import { RunnerArgument } from './runner-argument.enum.js';

type Body = (...args: unknown[]) => unknown;
type Registration = { name: string; fn?: Body; timeout?: number; args: unknown[] };
type RowRegistrar = (name: string, fn: Body, timeout?: number) => void;

class NeutralRunnerFake {
  private static ROW: VariantNode = { call: 'register', variants: {}, forward: 'all' };
  private static PAIR: VariantNode = { call: 'register', variants: {}, forward: 'first' };
  private static ROWS: VariantNode = {
    call: 'table',
    variants: {},
    returns: NeutralRunnerFake.ROW,
  };
  private static TEST: VariantNode = {
    call: 'register',
    forward: 'none',
    variants: {
      plan: { call: 'passthrough', variants: {} },
      rows: NeutralRunnerFake.ROWS,
      pairs: { call: 'table', variants: {}, returns: NeutralRunnerFake.PAIR },
      focus: { call: 'register', forward: 'none', variants: { rows: NeutralRunnerFake.ROWS } },
    },
  };
  private static GROUP: VariantNode = {
    call: 'register',
    forward: 'none',
    variants: { rows: NeutralRunnerFake.ROWS },
  };

  registrations: Registration[] = [];

  test = Object.assign(this.single(), {
    focus: Object.assign(this.single(), { rows: this.rows() }),
    plan: (name: string): void => {
      this.registrations.push({ name, args: [] });
    },
    rows: this.rows(),
    pairs:
      (table: readonly unknown[]): RowRegistrar =>
      (name, fn, timeout) => {
        for (const row of table) {
          this.registrations.push({ name, fn, timeout, args: [row, RunnerArgument.Context] });
        }
      },
    inverted: this.single(),
    extra: this.single(),
  });

  group = Object.assign(
    (_name: string, fn: Body): void => {
      fn(RunnerArgument.Collector);
    },
    {
      rows:
        (table: readonly unknown[][]): RowRegistrar =>
        (_name, fn) => {
          for (const row of table) {
            fn(...row);
          }
        },
    },
  );

  spec(present = true): RunnerSpec {
    return {
      test: {
        subject: 'crucible.it',
        locate: () => (present ? this.test : undefined),
        node: NeutralRunnerFake.TEST,
        blocked: { inverted: BlockedReason.InvertedOutcome },
      },
      group: {
        subject: 'crucible.describe',
        locate: () => (present ? this.group : undefined),
        node: NeutralRunnerFake.GROUP,
        blocked: {},
      },
      testArguments: (name: unknown, test: GatedTest, timeout: number) => [name, test, timeout],
      groupArguments: (name: unknown, callback: GroupCallback) => [name, callback],
    };
  }

  async run(): Promise<void> {
    for (const { fn, args } of this.registrations) {
      await fn?.(...args);
    }
  }

  timeouts(): (number | undefined)[] {
    return this.registrations.map((registration) => registration.timeout);
  }

  names(): string[] {
    return this.registrations.map((registration) => registration.name);
  }

  private single(): RowRegistrar {
    return (name, fn, timeout) => {
      this.registrations.push({ name, fn, timeout, args: [RunnerArgument.Context] });
    };
  }

  private rows(): (table: readonly unknown[][]) => RowRegistrar {
    return (table) => (name, fn, timeout) => {
      for (const row of table) {
        this.registrations.push({ name, fn, timeout, args: row });
      }
    };
  }
}

export { NeutralRunnerFake };
