import { TestStatus } from './test-status.enum.js';
import { VitestArgument } from './vitest-argument.enum.js';
import type { TestResult } from './fake-runner.fake.js';

type Mode = 'run' | 'only' | 'skip' | 'todo';
type Body = (...args: unknown[]) => unknown;
type Options = { timeout?: number; concurrent?: boolean; shuffle?: boolean };
type Scheduling = { concurrent?: boolean; shuffle?: boolean };
type Suite = Scheduling & {
  suite?: Suite;
  name: string;
  mode: Mode;
  factory?: Body;
  children: Entry[];
};
type Case = {
  suite: Suite;
  name: string;
  mode: Mode;
  fn?: () => unknown;
  timeout?: number;
  concurrent: boolean;
};
type Entry = { kind: 'suite'; suite: Suite } | { kind: 'case'; test: Case };
type Registrar = (name: string, optionsOrFn?: Options | Body, fnOrTimeout?: Body | number) => void;
type Table = (cases: readonly unknown[]) => Registrar;
type Parsed = { options: Options; fn?: Body };

class VitestRunnerFake {
  private file: Suite = { name: '', mode: 'run', children: [] };
  private current: Suite = this.file;
  private cases: Case[] = [];

  test = Object.assign(this.testIn('run'), {
    only: Object.assign(this.testIn('only'), this.testTables('only')),
    skip: Object.assign(this.testIn('skip'), this.testTables('skip')),
    todo: this.testIn('todo'),
    ...this.testTables('run'),
    skipIf: (condition: unknown): Registrar => this.testIn(condition ? 'skip' : 'run'),
    runIf: (condition: unknown): Registrar => this.testIn(condition ? 'run' : 'skip'),
    fails: this.testIn('run'),
    concurrent: this.testIn('run', { concurrent: true }),
    extend: this.testIn('run'),
  });

  describe = Object.assign(this.suiteIn('run'), {
    only: Object.assign(this.suiteIn('only'), this.suiteTables('only')),
    skip: Object.assign(this.suiteIn('skip'), this.suiteTables('skip')),
    todo: this.suiteIn('todo'),
    ...this.suiteTables('run'),
    skipIf: (condition: unknown): Registrar => this.suiteIn(condition ? 'skip' : 'run'),
    runIf: (condition: unknown): Registrar => this.suiteIn(condition ? 'run' : 'skip'),
    concurrent: this.suiteIn('run', { concurrent: true }),
    shuffle: this.suiteIn('run', { shuffle: true }),
  });

  source = {
    test: this.test,
    describe: this.describe,
    currentGroup: (): unknown => (this.current === this.file ? {} : { suite: this.current }),
  };

  collect(): void {
    this.collectSuite(this.file);
  }

  names(): string[] {
    this.collect();
    return this.cases.map((test) => VitestRunnerFake.fullName(test));
  }

  timeoutOf(name: string): number | undefined {
    this.collect();
    return this.cases.find((test) => VitestRunnerFake.fullName(test) === name)?.timeout;
  }

  async run(): Promise<TestResult[]> {
    this.collect();
    const focused = this.cases.some((test) => VitestRunnerFake.modes(test).includes('only'));
    const results: TestResult[] = [];
    for (const batch of VitestRunnerFake.batches(this.cases)) {
      const outcomes = await Promise.all(
        batch.map(async (test) => ({
          name: VitestRunnerFake.fullName(test),
          status: await VitestRunnerFake.outcome(test, focused),
        })),
      );
      results.push(...outcomes);
    }
    return results;
  }

  private collectSuite(suite: Suite): void {
    const children = suite.shuffle ? [...suite.children].reverse() : suite.children;
    suite.children = [];
    for (const entry of children) {
      if (entry.kind === 'case') {
        this.cases.push(entry.test);
        continue;
      }
      const previous = this.current;
      this.current = entry.suite;
      try {
        entry.suite.factory?.(VitestArgument.Collector);
      } finally {
        this.current = previous;
      }
      this.collectSuite(entry.suite);
    }
  }

  private testIn(mode: Mode, scheduling: Scheduling = {}): Registrar {
    return (name, optionsOrFn, fnOrTimeout) => {
      const { options, fn } = VitestRunnerFake.parse(optionsOrFn, fnOrTimeout);
      const run = fn === undefined ? undefined : () => fn(VitestArgument.Context);
      this.register(name, mode, run, { ...scheduling, ...options });
    };
  }

  private testTables(mode: Mode): { each: Table; for: Table } {
    return {
      each: (cases) => (name, optionsOrFn, fnOrTimeout) => {
        const { options, fn } = VitestRunnerFake.parse(optionsOrFn, fnOrTimeout);
        const arrays = cases.every(Array.isArray);
        for (const row of cases) {
          const args = arrays ? (row as unknown[]) : [row];
          this.register(VitestRunnerFake.format(name, row), mode, () => fn?.(...args), options);
        }
      },
      for: (cases) => (name, optionsOrFn, fnOrTimeout) => {
        const { options, fn } = VitestRunnerFake.parse(optionsOrFn, fnOrTimeout);
        for (const row of cases) {
          const run = () => fn?.(row, VitestArgument.Context);
          this.register(VitestRunnerFake.format(name, row), mode, run, options);
        }
      },
    };
  }

  private suiteIn(mode: Mode, scheduling: Scheduling = {}): Registrar {
    return (name, optionsOrFn, fnOrTimeout) => {
      const { options, fn } = VitestRunnerFake.parse(optionsOrFn, fnOrTimeout);
      const parent = this.current;
      const suite: Suite = {
        suite: parent,
        name,
        mode,
        factory: fn,
        children: [],
        concurrent: scheduling.concurrent ?? options.concurrent ?? parent.concurrent,
        shuffle: scheduling.shuffle ?? options.shuffle ?? parent.shuffle,
      };
      parent.children.push({ kind: 'suite', suite });
    };
  }

  private suiteTables(mode: Mode): { each: Table; for: Table } {
    const suite = this.suiteIn(mode);
    return {
      each: (cases) => (name, optionsOrFn, fnOrTimeout) => {
        const { options, fn } = VitestRunnerFake.parse(optionsOrFn, fnOrTimeout);
        const arrays = cases.every(Array.isArray);
        for (const row of cases) {
          const args = arrays ? (row as unknown[]) : [row];
          suite(VitestRunnerFake.format(name, row), options, () => fn?.(...args));
        }
      },
      for: (cases) => (name, optionsOrFn, fnOrTimeout) => {
        const { options, fn } = VitestRunnerFake.parse(optionsOrFn, fnOrTimeout);
        for (const row of cases) {
          suite(VitestRunnerFake.format(name, row), options, () => fn?.(row));
        }
      },
    };
  }

  private register(name: string, mode: Mode, fn: (() => unknown) | undefined, options: Options) {
    const suite = this.current;
    const concurrent = options.concurrent ?? suite.concurrent ?? false;
    const test: Case = { suite, name, mode, fn, timeout: options.timeout, concurrent };
    suite.children.push({ kind: 'case', test });
  }

  private static parse(optionsOrFn?: Options | Body, fnOrTimeout?: Body | number): Parsed {
    if (typeof optionsOrFn === 'function') {
      const timeout = typeof fnOrTimeout === 'number' ? fnOrTimeout : undefined;
      return { options: { timeout }, fn: optionsOrFn };
    }
    const fn = typeof fnOrTimeout === 'function' ? fnOrTimeout : undefined;
    return { options: optionsOrFn ?? {}, fn };
  }

  private static batches(cases: Case[]): Case[][] {
    const batches: Case[][] = [];
    for (const test of cases) {
      const last = batches.at(-1);
      if (test.concurrent && last?.[0]?.concurrent) {
        last.push(test);
      } else {
        batches.push([test]);
      }
    }
    return batches;
  }

  private static modes(test: Case): Mode[] {
    const modes: Mode[] = [test.mode];
    for (let suite: Suite | undefined = test.suite; suite; suite = suite.suite) {
      modes.push(suite.mode);
    }
    return modes;
  }

  private static async outcome(test: Case, focused: boolean): Promise<TestStatus> {
    const modes = VitestRunnerFake.modes(test);
    if (modes.includes('todo') || test.fn === undefined) {
      return TestStatus.Todo;
    }
    if (modes.includes('skip') || (focused && !modes.includes('only'))) {
      return TestStatus.Skipped;
    }
    try {
      await test.fn();
      return TestStatus.Passed;
    } catch {
      return TestStatus.Failed;
    }
  }

  private static fullName(test: Case): string {
    const names = [test.name];
    for (let suite: Suite | undefined = test.suite; suite?.suite; suite = suite.suite) {
      names.unshift(suite.name);
    }
    return names.join(' > ');
  }

  private static format(name: string, row: unknown): string {
    if (Array.isArray(row)) {
      const values = [...row];
      return name.replace(/%s/g, () => String(values.shift()));
    }
    if (typeof row === 'object' && row !== null) {
      const fields = row as Record<string, unknown>;
      return name.replace(/\$(\w+)/g, (_match, key: string) => String(fields[key]));
    }
    return name.replace('%s', String(row));
  }
}

export { VitestRunnerFake };
