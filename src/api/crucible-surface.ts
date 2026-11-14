import type { TestBody } from '../bindings/jest.js';
import type { ExtractedValueFor } from '../core/extract-type.js';
import type { ExtractOptions } from './extract-options.js';
import type { RunOptions } from './run-options.js';

type CrucibleSurface = {
  /**
   * Registers one Jest test that executes `body` concurrently `runs` times
   * and passes when at least `threshold` of the runs pass. Both come from
   * the enclosing `crucible.describe`, else `testDefaults` in
   * `crucible.config.json`, else the built-in 10 runs at
   * 0.9 (9 of 10 must pass). Every run calls your system under test and the
   * judge, so the built-ins cost 10 runs of your system and 10 judge calls
   * per assertion. For a single run that must pass, use
   * `crucible.it(name, { runs: 1, threshold: 1 }, body)` or set it in
   * `testDefaults`.
   *
   * @param name - The Jest test name.
   * @param body - Arrange, act and assert; runs once per run.
   */
  it(name: string, body: TestBody): void;
  /**
   * Registers one Jest test with the default `runs` and `threshold`
   * (enclosing `crucible.describe`, else `testDefaults`, else 10 runs at
   * 0.9) and a test timeout, like Jest's
   * `it(name, fn, timeout)`.
   *
   * @param name - The Jest test name.
   * @param body - Arrange, act and assert; runs once per run.
   * @param timeout - Milliseconds for the whole test, every run included.
   *   Same as the `testTimeout` option; `undefined` keeps the default.
   */
  it(name: string, body: TestBody, timeout: number | undefined): void;
  /**
   * Registers one Jest test that executes `body` `options.runs` times
   * concurrently and passes when at least `options.threshold` of the runs
   * pass. Each omitted option comes from the enclosing `crucible.describe`,
   * then `testDefaults`, then the built-in
   * default (`runs` 10, `threshold` 0.9).
   *
   * @param name - The Jest test name.
   * @param options - Run count, pass threshold, time budgets and
   *   extraction strictness.
   * @param body - Arrange, act and assert; runs once per run.
   */
  it(name: string, options: RunOptions, body: TestBody): void;
  /**
   * Registers one Jest test with run options and a trailing test timeout.
   * Passing both `timeout` and `options.testTimeout` is a `usage` error; a
   * `testTimeout` from an enclosing `crucible.describe` is overridden.
   *
   * @param name - The Jest test name.
   * @param options - Run count, pass threshold, inference timeout and
   *   extraction strictness.
   * @param body - Arrange, act and assert; runs once per run.
   * @param timeout - Milliseconds for the whole test, every run included;
   *   `undefined` keeps `options.testTimeout` or the default.
   */
  it(name: string, options: RunOptions, body: TestBody, timeout: number | undefined): void;
  /**
   * Registers a Jest `describe` block named `name` and runs `fn` to collect
   * its tests. Behaves like `describe(name, fn)`: `fn` must be synchronous
   * and return nothing.
   *
   * @param name - The Jest describe name.
   * @param fn - Declares the tests and nested groups; must not be async.
   */
  describe(name: string, fn: () => void): void;
  /**
   * Registers a Jest `describe` block named `name` whose `options` every
   * `crucible.it()` inside inherits, at any depth (plain `describe` blocks in
   * between included). Each field resolves on its own, last wins: built-in
   * default, `testDefaults`, outer `crucible.describe`, inner
   * `crucible.describe`, then the test's own options or trailing timeout.
   * Without a `testTimeout` at any level the test timeout follows the
   * resolved `runs`. Invalid options, an argument after `fn`, or an `fn`
   * that returns a value (an async `fn` included) are a `usage` error.
   *
   * @param name - The Jest describe name.
   * @param options - Run count, pass threshold, time budgets and
   *   extraction strictness shared by
   *   every test in the group.
   * @param fn - Declares the tests and nested groups; must not be async.
   */
  describe(name: string, options: RunOptions, fn: () => void): void;
  /**
   * Asks the judge whether `actual` is semantically consistent with
   * `expectation`, given the state the current run has loaded. Resolves to
   * the verdict; never throws on `false`. One judge call per run.
   *
   * @param actual - Your system's output.
   * @param expectation - A natural-language claim about it.
   */
  coherent(actual: string, expectation: string): Promise<boolean>;
  /**
   * Asks the judge for one value stated in `text`, typed as `options.as`
   * asks, or `null` when the text commits to none. Lenient by default: the
   * value a reply leans to counts ("probably two" is `2`); with `strict`
   * any hedge is `null`. One judge call per run.
   *
   * @param text - The prose to read, usually your system's output.
   * @param description - What to extract, in natural language.
   * @param options - `as`: `'string'`, `'number'` or `'boolean'`
   *   (default `'string'`); `strict`: `true` to treat any hedge as `null`
   *   (default: the test's resolved `strict`, else `false`).
   */
  extract<O extends ExtractOptions | undefined = undefined>(
    text: string,
    description: string,
    options?: O,
  ): Promise<ExtractedValueFor<O>>;
  /**
   * Adds state to the current run while arranging, before the act. The
   * judge treats it as ground truth for every later assertion in this run.
   * Behaves exactly like `append`.
   *
   * @param state - One fact or several.
   */
  load(state: string | readonly string[]): void;
  /**
   * Adds state to the current run for facts that arise after an act.
   * Behaves exactly like `load`.
   *
   * @param state - One fact or several.
   */
  append(state: string | readonly string[]): void;
};

export type { CrucibleSurface };
