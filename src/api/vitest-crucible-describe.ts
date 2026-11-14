import type { GroupRegistrar, GroupTable, RowGroupRegistrar } from './crucible-describe.js';

/**
 * Vitest's `describe.for`: takes a table and returns a registrar for one
 * group per row; `fn` receives each row whole, never spread.
 */
type GroupForTable = {
  /**
   * A table of rows: each row is `fn`'s one argument.
   *
   * @param table - One row per group.
   */
  <Row>(table: readonly Row[]): RowGroupRegistrar<[Row]>;
  /**
   * A tagged template table: each row arrives as one object.
   */
  (
    strings: TemplateStringsArray,
    ...placeholders: unknown[]
  ): RowGroupRegistrar<[Record<string, unknown>]>;
};

/**
 * A focused or skipped Vitest group registrar, with its own `each` and
 * `for`.
 */
type VitestGroupVariant = GroupRegistrar & {
  /**
   * One group per table row, row values spread into `fn`, focused or
   * skipped like this variant.
   */
  readonly each: GroupTable;
  /**
   * One group per table row, the row whole as `fn`'s argument, focused or
   * skipped like this variant.
   */
  readonly for: GroupForTable;
};

/**
 * `crucible.describe` on Vitest: the two group forms, plus Vitest's `only`,
 * `skip`, `todo`, `each`, `for`, `skipIf` and `runIf` (and `only.each`,
 * `only.for`, `skip.each`, `skip.for`). Every variant takes the same forms
 * and options; tests inside inherit the options, plain `describe` blocks in
 * between included. Callbacks must be synchronous. `concurrent`, `shuffle`
 * and `sequential` are not supported.
 */
type VitestCrucibleDescribe = GroupRegistrar & {
  /**
   * Like `crucible.describe`, but Vitest runs only focused groups and tests
   * in the file.
   */
  readonly only: VitestGroupVariant;
  /**
   * Like `crucible.describe`, but Vitest skips every test inside.
   */
  readonly skip: VitestGroupVariant;
  /**
   * Plans a group by name only; Vitest lists it as todo.
   *
   * @param name - The planned group's name.
   */
  readonly todo: (name: string) => void;
  /**
   * One group per table row, row values spread into `fn`:
   * `crucible.describe.each([['free'], ['pro']])('%s plan', { runs: 5 }, (plan) => { ... })`.
   */
  readonly each: GroupTable;
  /**
   * One group per table row, the row whole as `fn`'s argument.
   */
  readonly for: GroupForTable;
  /**
   * Returns a group registrar that skips every test inside when `condition`
   * is truthy.
   *
   * @param condition - Skip the group when truthy.
   */
  readonly skipIf: (condition: unknown) => GroupRegistrar;
  /**
   * Returns a group registrar that runs its tests only when `condition` is
   * truthy.
   *
   * @param condition - Run the group when truthy; skip it otherwise.
   */
  readonly runIf: (condition: unknown) => GroupRegistrar;
};

export type { GroupForTable, VitestCrucibleDescribe, VitestGroupVariant };
