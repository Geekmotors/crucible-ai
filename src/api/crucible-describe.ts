import type { RunOptions } from './run-options.js';

/**
 * A group registrar with the two `crucible.describe` forms.
 */
type GroupRegistrar = {
  /**
   * Registers a `describe` block named `name` and runs `fn` to collect its
   * tests. Behaves like `describe(name, fn)`: `fn` must be synchronous and
   * return nothing.
   *
   * @param name - The describe name.
   * @param fn - Declares the tests and nested groups; must not be async.
   */
  (name: string, fn: () => void): void;
  /**
   * Registers a `describe` block named `name` whose `options` every
   * `crucible.it()` inside inherits, at any depth (plain `describe` blocks in
   * between included). Each field resolves on its own, last wins: built-in
   * default, `testDefaults`, outer `crucible.describe`, inner
   * `crucible.describe`, then the test's own options or trailing timeout.
   * Without a `testTimeout` at any level the test timeout follows the
   * resolved `runs`. Invalid options, an argument after `fn`, or an `fn`
   * that returns a value (an async `fn` included) are a `usage` error.
   *
   * @param name - The describe name.
   * @param options - Run count, pass threshold, time budgets and
   *   extraction strictness shared by every test in the group.
   * @param fn - Declares the tests and nested groups; must not be async.
   */
  (name: string, options: RunOptions, fn: () => void): void;
};

/**
 * Registers one group per table row, named with the runner's own
 * formatting; `fn` receives the row values.
 */
type RowGroupRegistrar<Row extends readonly unknown[]> = {
  /**
   * Registers one group per row; `fn` receives the row values.
   *
   * @param name - The describe name, formatted per row by the runner.
   * @param fn - Declares the row's tests; must not be async.
   */
  (name: string, fn: (...row: Row) => void): void;
  /**
   * Registers one group per row whose `options` every `crucible.it()`
   * inside inherits; `fn` receives the row values.
   *
   * @param name - The describe name, formatted per row by the runner.
   * @param options - Settings shared by every test in each row's group.
   * @param fn - Declares the row's tests; must not be async.
   */
  (name: string, options: RunOptions, fn: (...row: Row) => void): void;
};

/**
 * The runner's `describe.each`: takes a table and returns a registrar for
 * one group per row.
 */
type GroupTable = {
  /**
   * A table of array rows: each row's values are `fn`'s arguments.
   *
   * @param table - One array of values per group.
   */
  <Row extends readonly unknown[] | [unknown]>(table: readonly Row[]): RowGroupRegistrar<Row>;
  /**
   * A table of single values or objects: each value is `fn`'s argument.
   *
   * @param table - One value per group.
   */
  <Value>(table: readonly Value[]): RowGroupRegistrar<[Value]>;
  /**
   * A tagged template table: each row arrives as one object.
   */
  (
    strings: TemplateStringsArray,
    ...placeholders: unknown[]
  ): RowGroupRegistrar<[Record<string, unknown>]>;
};

/**
 * A focused or skipped group registrar, with its own `each`.
 */
type GroupVariant = GroupRegistrar & {
  /**
   * One group per table row, focused or skipped like this variant.
   */
  readonly each: GroupTable;
};

/**
 * `crucible.describe`: the two group forms, plus the runner's `only`,
 * `skip` and `each` variants (and `only.each`, `skip.each`). Every variant
 * takes the same forms and options; tests inside inherit the options.
 */
type CrucibleDescribe = GroupRegistrar & {
  /**
   * Like `crucible.describe`, but the runner runs only focused groups and
   * tests in the file.
   */
  readonly only: GroupVariant;
  /**
   * Like `crucible.describe`, but the runner skips every test inside.
   */
  readonly skip: GroupVariant;
  /**
   * One group per table row:
   * `crucible.describe.each([['free'], ['pro']])('%s plan', { runs: 5 }, (plan) => { ... })`.
   */
  readonly each: GroupTable;
};

export type { CrucibleDescribe, GroupRegistrar, GroupTable, GroupVariant, RowGroupRegistrar };
