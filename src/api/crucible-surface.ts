import type { ExtractedValueFor } from '../core/extract-type.js';
import type { CoherentOptions } from './coherent-options.js';
import type { ExtractOptions } from './extract-options.js';
import type { RunContext, TestBody } from './run-context.js';
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
   * @param body - Arrange, act and assert; runs once per run and receives
   *   that run's context `t` (`async (t) => ...`); a body that takes no
   *   argument works too.
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
   * Wraps `body` into a test function for your runner's own `it` or `test`,
   * any variant included (`it.only`, `it.each`, ...):
   * `it(name, crucible.gate(async (t) => { ... }), 60000)`. When the runner
   * calls it, the body runs `runs` times concurrently and the test passes
   * when at least `threshold` of the runs pass, with the same verdict
   * errors and report as `crucible.it`. Each run gets its own context `t`;
   * any arguments the runner passes (such as `it.each` row values) follow
   * `t`. Settings come from the enclosing `crucible.describe` (captured
   * when `crucible.gate` is called), else `testDefaults`, else 10 runs at
   * 0.9. The gate enforces its own `testTimeout` but cannot set the
   * runner's: pass the runner a timeout at least as large (Jest's default
   * is 5 seconds).
   *
   * Annotate row parameters to type them:
   * `it.each([[2, 'two']])('%s', crucible.gate(async (t, n: number, word: string) => { ... }))`.
   *
   * @param body - Arrange, act and assert; runs once per run with that
   *   run's context `t` and the runner's own arguments.
   * @returns A test function that declares no parameters, so runners never
   *   treat it as a `done`-callback test.
   */
  gate<A extends unknown[] = unknown[]>(
    body: (t: RunContext, ...args: A) => unknown,
  ): (...args: A) => Promise<void>;
  /**
   * Wraps `body` into a test function for your runner's own `it` or
   * `test`, with run options: `it(name, crucible.gate({ runs: 5 }, async
   * (t) => { ... }), 60000)`. Each omitted option comes from the enclosing
   * `crucible.describe`, then `testDefaults`, then the built-in default.
   * Invalid options, a missing body or an argument after the body are a
   * `usage` error when `crucible.gate` is called. Pass the runner a timeout
   * at least as large as the resolved `testTimeout`.
   *
   * @param options - Run count, pass threshold, time budgets and
   *   extraction strictness.
   * @param body - Arrange, act and assert; runs once per run with that
   *   run's context `t` and the runner's own arguments.
   * @returns A test function that declares no parameters.
   */
  gate<A extends unknown[] = unknown[]>(
    options: RunOptions,
    body: (t: RunContext, ...args: A) => unknown,
  ): (...args: A) => Promise<void>;
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
   * `expectation`, given the run's facts (from `crucible.facts()`) and any
   * `options.facts` for this call. Resolves to the verdict; never throws on
   * `false`. One judge call per run.
   *
   * @param actual - Your system's output.
   * @param expectation - A natural-language claim about it.
   * @param options - `facts`: facts for this call only, sent after the
   *   run's facts and not kept for later calls. Unknown keys are a `usage`
   *   error.
   */
  coherent(actual: string, expectation: string, options?: CoherentOptions): Promise<boolean>;
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
   *   (default: the test's resolved `strict`, else `false`); `facts`:
   *   facts for this call only, sent after the run's facts and not kept for
   *   later calls.
   */
  extract<O extends ExtractOptions | undefined = undefined>(
    text: string,
    description: string,
    options?: O,
  ): Promise<ExtractedValueFor<O>>;
  /**
   * Adds facts to the current run: the ground truth your system worked
   * from, such as its logs or the data it was given. The judge treats them
   * as true for every later `coherent()` and `extract()` call in this run.
   * Append-only; each run starts with none, and concurrent runs never see
   * each other's. Each assertion uses the facts added before it was called.
   * Only works inside a running `crucible.it()` or `crucible.gate()` body;
   * from callbacks that lost the async context, use the run context `t`.
   *
   * @param fact - One fact or several.
   */
  facts(fact: string | readonly string[]): void;
  /**
   * Adds facts to the current run. Behaves exactly like `crucible.facts()`.
   *
   * @deprecated Use `crucible.facts()`. Planned for removal in 1.0.
   * @param state - One fact or several.
   */
  load(state: string | readonly string[]): void;
  /**
   * Adds facts to the current run. Behaves exactly like `crucible.facts()`.
   *
   * @deprecated Use `crucible.facts()`. Planned for removal in 1.0.
   * @param state - One fact or several.
   */
  append(state: string | readonly string[]): void;
};

export type { CrucibleSurface };
