import type { ExtractedValueFor } from '../core/extract-type.js';
import type { CoherentOptions } from './coherent-options.js';
import type { ExtractOptions } from './extract-options.js';
import type { RunContext } from './run-context.js';
import type { RunOptions } from './run-options.js';

type CrucibleCoreSurface = {
  /**
   * Wraps `body` into a test function for your runner's own `it` or `test`,
   * any variant included (`it.only`, `it.each`, ...):
   * `it(name, crucible.gate(async (t) => { ... }), 60000)`. When the runner
   * calls it, the body runs `runs` times concurrently and the test passes
   * when at least `threshold` of the runs pass, with the same verdict
   * errors and report as `crucible.it`. Each run gets its own context `t`;
   * any arguments the runner passes (such as `it.each` row values, or
   * Vitest's test context on a plain `test`) follow `t`. Settings come from the enclosing `crucible.describe` (captured
   * when `crucible.gate` is called), else `testDefaults`, else 10 runs at
   * 0.9. The gate enforces its own `testTimeout` but cannot set the
   * runner's: pass the runner a timeout at least as large (Jest's and
   * Vitest's default is 5 seconds).
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

export type { CrucibleCoreSurface };
