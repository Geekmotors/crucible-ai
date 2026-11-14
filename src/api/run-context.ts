import type { ExtractedValueFor } from '../core/extract-type.js';
import type { CoherentOptions } from './coherent-options.js';
import type { ExtractOptions } from './extract-options.js';

/**
 * The run context `t` each run of a `crucible.it()` or `crucible.gate()`
 * body receives as its first argument: `facts`, `coherent` and `extract`,
 * bound to that run. It shares its run's state with the global
 * `crucible.*` functions, keeps working from callbacks that lost the async
 * context, and is a `usage` error once its run has ended.
 */
type RunContext = {
  /**
   * Adds facts to this run: the ground truth your system worked from, such
   * as its logs or the data it was given. Same as `crucible.facts()`, bound
   * to this run, so it also works from callbacks that lost the async
   * context (event emitters, custom schedulers). Using `t` after its run
   * has ended is a `usage` error.
   *
   * @param fact - One fact or several.
   */
  facts(fact: string | readonly string[]): void;
  /**
   * Asks the judge whether `actual` is semantically consistent with
   * `expectation`, given this run's facts and any `options.facts` for this
   * call. Same as `crucible.coherent()`, bound to this run. Resolves to the
   * verdict; never throws on `false`. Rejects with a `usage` error after
   * the run has ended.
   *
   * @param actual - Your system's output.
   * @param expectation - A natural-language claim about it.
   * @param options - `facts`: facts for this call only.
   */
  coherent(actual: string, expectation: string, options?: CoherentOptions): Promise<boolean>;
  /**
   * Asks the judge for one value stated in `text`, typed as `options.as`
   * asks, or `null` when the text commits to none. Same as
   * `crucible.extract()`, bound to this run. Rejects with a `usage` error
   * after the run has ended.
   *
   * @param text - The prose to read, usually your system's output.
   * @param description - What to extract, in natural language.
   * @param options - `as`, `strict` and `facts`, as for `crucible.extract()`.
   */
  extract<O extends ExtractOptions | undefined = undefined>(
    text: string,
    description: string,
    options?: O,
  ): Promise<ExtractedValueFor<O>>;
};

/**
 * The body passed to `crucible.it()`, usually `async`. It receives its run's
 * context `t`; a body without parameters fits too.
 */
type TestBody = (t: RunContext) => unknown;

/**
 * The body passed to `crucible.gate()`: its run's context `t`, then the
 * arguments the runner passes (such as `it.each` row values) typed as `A`.
 */
type GateBody<A extends unknown[] = unknown[]> = (t: RunContext, ...args: A) => unknown;

/**
 * The test function `crucible.gate()` returns, for the runner's own `it` or
 * `test`. It declares no parameters, so runners never treat it as a
 * `done`-callback test, and forwards the runner's arguments `A` to the body.
 */
type GatedTest<A extends unknown[] = unknown[]> = (...args: A) => Promise<void>;

export type { GateBody, GatedTest, RunContext, TestBody };
