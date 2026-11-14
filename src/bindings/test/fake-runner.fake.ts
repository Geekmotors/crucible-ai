import { TestStatus } from './test-status.enum.js';

type Mode = 'run' | 'only' | 'skip';
type Body = (...args: unknown[]) => unknown;
type Registrar = (name: string, fn: Body, timeout?: number) => void;
type FakeTest = {
  name: string;
  fn?: Body;
  timeout?: number;
  mode: Mode | 'todo';
};
type TestResult = { name: string; status: TestStatus };

class FakeRunner {
  private tests: FakeTest[] = [];
  private path: string[] = [];
  private modes: Mode[] = [];

  it = Object.assign(this.testIn('run'), {
    only: Object.assign(this.testIn('only'), { each: this.tableOf(this.testIn('only')) }),
    skip: Object.assign(this.testIn('skip'), { each: this.tableOf(this.testIn('skip')) }),
    todo: (name: string): void => {
      this.tests.push({ name: this.fullName(name), mode: 'todo' });
    },
    each: this.tableOf(this.testIn('run')),
    failing: this.testIn('run'),
    concurrent: this.testIn('run'),
    sequential: this.testIn('run'),
  });

  describe = Object.assign(this.groupIn('run'), {
    only: Object.assign(this.groupIn('only'), { each: this.tableOf(this.groupIn('only')) }),
    skip: Object.assign(this.groupIn('skip'), { each: this.tableOf(this.groupIn('skip')) }),
    each: this.tableOf(this.groupIn('run')),
  });

  globals = { it: this.it, describe: this.describe };

  names(): string[] {
    return this.tests.map((test) => test.name);
  }

  timeoutOf(name: string): number | undefined {
    return this.tests.find((test) => test.name === name)?.timeout;
  }

  async run(): Promise<TestResult[]> {
    const focused = this.tests.some((test) => test.mode === 'only');
    const results: TestResult[] = [];
    for (const test of this.tests) {
      results.push({ name: test.name, status: await FakeRunner.outcome(test, focused) });
    }
    return results;
  }

  private static async outcome(test: FakeTest, focused: boolean): Promise<TestStatus> {
    if (test.mode === 'todo') {
      return TestStatus.Todo;
    }
    if (test.mode === 'skip' || (focused && test.mode !== 'only')) {
      return TestStatus.Skipped;
    }
    try {
      await test.fn?.();
      return TestStatus.Passed;
    } catch {
      return TestStatus.Failed;
    }
  }

  private testIn(mode: Mode): Registrar {
    return (name, fn, timeout) => {
      this.tests.push({ name: this.fullName(name), fn, timeout, mode: this.effective(mode) });
    };
  }

  private groupIn(mode: Mode): Registrar {
    return (name, fn) => {
      this.path.push(name);
      this.modes.push(mode);
      try {
        fn();
      } finally {
        this.path.pop();
        this.modes.pop();
      }
    };
  }

  private tableOf(register: Registrar): (table: readonly unknown[]) => Registrar {
    return (table) => (name, fn, timeout) => {
      for (const row of table) {
        const args = Array.isArray(row) ? row : [row];
        register(FakeRunner.format(name, row), () => fn(...args), timeout);
      }
    };
  }

  private effective(mode: Mode): Mode {
    const modes = [...this.modes, mode];
    if (modes.includes('skip')) {
      return 'skip';
    }
    return modes.includes('only') ? 'only' : 'run';
  }

  private fullName(name: string): string {
    return [...this.path, name].join(' > ');
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

export { FakeRunner };
export type { TestResult };
