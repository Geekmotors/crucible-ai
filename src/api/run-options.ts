import type { RunOptions as ResolvableRunOptions } from '../core/run-options.js';

type RunOptions = {
  /**
   * How many times the whole test body (arrange, act, assert) executes. All
   * runs start at once. Each run calls your system under test and the judge,
   * so 10 runs cost 10 runs of your system and 10 judge calls per assertion.
   * Integer ≥ 1.
   *
   * @default the enclosing crucible.describe, else testDefaults.runs, else 10
   */
  readonly runs?: ResolvableRunOptions['runs'];
  /**
   * Minimum fraction of runs that must pass for the test to pass; the number
   * of runs needed is rounded up, so 0.9 of fewer than 10 runs needs every
   * run. Number in (0, 1].
   *
   * @default the enclosing crucible.describe, else testDefaults.threshold, else 0.9 (9 of 10 runs)
   */
  readonly threshold?: ResolvableRunOptions['threshold'];
  /**
   * Milliseconds each `crucible.coherent()` or `crucible.extract()` judge
   * reply attempt may take, provider retries included. Integer from 1 to
   * 2147483647.
   *
   * @default the enclosing crucible.describe, else testDefaults.inferenceTimeout, else 30000
   */
  readonly inferenceTimeout?: ResolvableRunOptions['inferenceTimeout'];
  /**
   * Milliseconds the whole test may take, every run included. A trailing
   * `timeout` argument to `crucible.it()` sets the same budget. Integer from
   * 1 to 2147483647.
   *
   * @default the enclosing crucible.describe, else testDefaults.testTimeout, else 30000 + 1000 × (runs − 1) (39000 for 10 runs)
   */
  readonly testTimeout?: ResolvableRunOptions['testTimeout'];
};

export type { RunOptions };
