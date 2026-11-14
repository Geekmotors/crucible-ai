import type { RunContext, TestBody } from './run-context.js';
import type { RunOptions } from './run-options.js';

/**
 * A test registrar with the four `crucible.it` forms. Every form registers
 * one test with your runner that executes `body` `runs` times concurrently
 * and passes when at least `threshold` of the runs pass.
 */
type TestRegistrar = {
  /**
   * Registers one test that executes `body` concurrently `runs` times and
   * passes when at least `threshold` of the runs pass. Both come from the
   * enclosing `crucible.describe`, else `testDefaults` in
   * `crucible.config.json`, else the built-in 10 runs at 0.9 (9 of 10 must
   * pass). Every run calls your system under test and the judge, so the
   * built-ins cost 10 runs of your system and 10 judge calls per assertion.
   * For a single run that must pass, use
   * `crucible.it(name, { runs: 1, threshold: 1 }, body)` or set it in
   * `testDefaults`.
   *
   * @param name - The test name.
   * @param body - Arrange, act and assert; runs once per run and receives
   *   that run's context `t` (`async (t) => ...`); a body that takes no
   *   argument works too.
   */
  (name: string, body: TestBody): void;
  /**
   * Registers one test with the default `runs` and `threshold` (enclosing
   * `crucible.describe`, else `testDefaults`, else 10 runs at 0.9) and a
   * test timeout, like Jest's `it(name, fn, timeout)`.
   *
   * @param name - The test name.
   * @param body - Arrange, act and assert; runs once per run.
   * @param timeout - Milliseconds for the whole test, every run included.
   *   Same as the `testTimeout` option; `undefined` keeps the default.
   */
  (name: string, body: TestBody, timeout: number | undefined): void;
  /**
   * Registers one test that executes `body` `options.runs` times
   * concurrently and passes when at least `options.threshold` of the runs
   * pass. Each omitted option comes from the enclosing `crucible.describe`,
   * then `testDefaults`, then the built-in default (`runs` 10, `threshold`
   * 0.9).
   *
   * @param name - The test name.
   * @param options - Run count, pass threshold, time budgets and
   *   extraction strictness.
   * @param body - Arrange, act and assert; runs once per run.
   */
  (name: string, options: RunOptions, body: TestBody): void;
  /**
   * Registers one test with run options and a trailing test timeout.
   * Passing both `timeout` and `options.testTimeout` is a `usage` error; a
   * `testTimeout` from an enclosing `crucible.describe` is overridden.
   *
   * @param name - The test name.
   * @param options - Run count, pass threshold, inference timeout and
   *   extraction strictness.
   * @param body - Arrange, act and assert; runs once per run.
   * @param timeout - Milliseconds for the whole test, every run included;
   *   `undefined` keeps `options.testTimeout` or the default.
   */
  (name: string, options: RunOptions, body: TestBody, timeout: number | undefined): void;
};

/**
 * The body of a `crucible.it.each` test: its run's context `t`, then the
 * row values `Row` the runner passes.
 */
type RowTestBody<Row extends readonly unknown[]> = (t: RunContext, ...row: Row) => unknown;

/**
 * Registers one test per table row, named with the runner's own formatting
 * (`%s`, `%i`, `$name`, ...). Each row's test runs its body `runs` times and
 * gates on `threshold`, like `crucible.it`.
 */
type RowTestRegistrar<Row extends readonly unknown[]> = {
  /**
   * Registers one test per row. The body receives `t`, then the row values.
   *
   * @param name - The test name, formatted per row by the runner.
   * @param body - Arrange, act and assert; runs once per run.
   * @param timeout - Milliseconds for each row's test, every run included.
   */
  (name: string, body: RowTestBody<Row>, timeout?: number): void;
  /**
   * Registers one test per row with run options. The body receives `t`,
   * then the row values.
   *
   * @param name - The test name, formatted per row by the runner.
   * @param options - Run count, pass threshold, time budgets and
   *   extraction strictness.
   * @param body - Arrange, act and assert; runs once per run.
   * @param timeout - Milliseconds for each row's test, every run included;
   *   passing it with `options.testTimeout` is a `usage` error.
   */
  (name: string, options: RunOptions, body: RowTestBody<Row>, timeout?: number): void;
};

/**
 * The runner's `each`: takes a table and returns a registrar for one test
 * per row.
 */
type TestTable = {
  /**
   * A table of array rows: each row's values follow `t` in the body.
   *
   * @param table - One array of values per test.
   */
  <Row extends readonly unknown[] | [unknown]>(table: readonly Row[]): RowTestRegistrar<Row>;
  /**
   * A table of single values or objects: each value is the one argument
   * after `t` in the body.
   *
   * @param table - One value per test.
   */
  <Value>(table: readonly Value[]): RowTestRegistrar<[Value]>;
  /**
   * A tagged template table: each row arrives as one object after `t`.
   */
  (
    strings: TemplateStringsArray,
    ...placeholders: unknown[]
  ): RowTestRegistrar<[Record<string, unknown>]>;
};

/**
 * A focused or skipped test registrar, with its own `each`.
 */
type TestVariant = TestRegistrar & {
  /**
   * One test per table row, focused or skipped like this variant.
   */
  readonly each: TestTable;
};

/**
 * `crucible.it`: the four test forms, plus the runner's `only`, `skip`,
 * `todo` and `each` variants (and `only.each`, `skip.each`). Every variant
 * takes the same forms and options and runs its body through the gate.
 * `failing` and `concurrent` are not supported.
 */
type CrucibleIt = TestRegistrar & {
  /**
   * Like `crucible.it`, but the runner runs only focused tests in the file.
   */
  readonly only: TestVariant;
  /**
   * Like `crucible.it`, but the runner skips the test: its body never runs
   * and costs no judge calls.
   */
  readonly skip: TestVariant;
  /**
   * Plans a test by name only; the runner lists it as todo. Takes no body
   * or options.
   *
   * @param name - The planned test's name.
   */
  readonly todo: (name: string) => void;
  /**
   * One test per table row:
   * `crucible.it.each([[2, 'two']])('%s', async (t, n, word) => { ... })`.
   * Each row's test runs its body `runs` times and gates on `threshold`.
   */
  readonly each: TestTable;
};

export type { CrucibleIt, RowTestBody, RowTestRegistrar, TestRegistrar, TestTable, TestVariant };
