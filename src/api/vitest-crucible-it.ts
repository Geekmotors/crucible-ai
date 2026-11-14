import type { TestRegistrar, TestTable } from './crucible-it.js';
import type { RunContext } from './run-context.js';
import type { RunOptions } from './run-options.js';

/**
 * The body of a `crucible.it.for` test: its run's context `t`, then the
 * whole row as one argument. Vitest's test context is not passed.
 */
type ForTestBody<Row> = (t: RunContext, row: Row) => unknown;

/**
 * Registers one test per row of a `crucible.it.for` table, named with
 * Vitest's formatting. Each row's test runs its body `runs` times and gates
 * on `threshold`, like `crucible.it`.
 */
type ForTestRegistrar<Row> = {
  /**
   * Registers one test per row. The body receives `t`, then the row.
   *
   * @param name - The test name, formatted per row by Vitest.
   * @param body - Arrange, act and assert; runs once per run.
   * @param timeout - Milliseconds for each row's test, every run included.
   */
  (name: string, body: ForTestBody<Row>, timeout?: number): void;
  /**
   * Registers one test per row with run options. The body receives `t`,
   * then the row.
   *
   * @param name - The test name, formatted per row by Vitest.
   * @param options - Run count, pass threshold, time budgets and
   *   extraction strictness.
   * @param body - Arrange, act and assert; runs once per run.
   * @param timeout - Milliseconds for each row's test, every run included;
   *   passing it with `options.testTimeout` is a `usage` error.
   */
  (name: string, options: RunOptions, body: ForTestBody<Row>, timeout?: number): void;
};

/**
 * Vitest's `test.for`: takes a table and returns a registrar for one test
 * per row; the body receives each row whole, never spread.
 */
type TestForTable = {
  /**
   * A table of rows: each row is the one argument after `t`.
   *
   * @param table - One row per test.
   */
  <Row>(table: readonly Row[]): ForTestRegistrar<Row>;
  /**
   * A tagged template table: each row arrives as one object after `t`.
   */
  (
    strings: TemplateStringsArray,
    ...placeholders: unknown[]
  ): ForTestRegistrar<Record<string, unknown>>;
};

/**
 * A focused or skipped Vitest test registrar, with its own `each` and `for`.
 */
type VitestTestVariant = TestRegistrar & {
  /**
   * One test per table row, row values spread after `t`, focused or skipped
   * like this variant.
   */
  readonly each: TestTable;
  /**
   * One test per table row, the row whole after `t`, focused or skipped like
   * this variant.
   */
  readonly for: TestForTable;
};

/**
 * `crucible.it` on Vitest: the four test forms, plus Vitest's `only`,
 * `skip`, `todo`, `each`, `for`, `skipIf` and `runIf` (and `only.each`,
 * `only.for`, `skip.each`, `skip.for`). Every variant takes the same forms
 * and options and runs its body through the gate; bodies receive `t`, never
 * Vitest's test context. `fails` and `concurrent` are not supported.
 */
type VitestCrucibleIt = TestRegistrar & {
  /**
   * Like `crucible.it`, but Vitest runs only focused tests in the file.
   */
  readonly only: VitestTestVariant;
  /**
   * Like `crucible.it`, but Vitest skips the test: its body never runs and
   * costs no judge calls.
   */
  readonly skip: VitestTestVariant;
  /**
   * Plans a test by name only; Vitest lists it as todo. Takes no body or
   * options.
   *
   * @param name - The planned test's name.
   */
  readonly todo: (name: string) => void;
  /**
   * One test per table row, row values spread after `t`:
   * `crucible.it.each([[2, 'two']])('%s', async (t, n, word) => { ... })`.
   */
  readonly each: TestTable;
  /**
   * One test per table row, the row whole after `t`:
   * `crucible.it.for([[2, 'two']])('%s', async (t, [n, word]) => { ... })`.
   */
  readonly for: TestForTable;
  /**
   * Returns a registrar that skips its test when `condition` is truthy:
   * `crucible.it.skipIf(isCi)(name, [options,] async (t) => { ... })`.
   *
   * @param condition - Skip the test when truthy.
   */
  readonly skipIf: (condition: unknown) => TestRegistrar;
  /**
   * Returns a registrar that runs its test only when `condition` is truthy.
   *
   * @param condition - Run the test when truthy; skip it otherwise.
   */
  readonly runIf: (condition: unknown) => TestRegistrar;
};

export type { ForTestBody, ForTestRegistrar, TestForTable, VitestCrucibleIt, VitestTestVariant };
