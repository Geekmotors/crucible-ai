import { CrucibleError } from './errors.js';
import { RunOptionsValidator } from './run-options-validator.util.js';
import type { ResolvedRunOptions, RunOptions } from './run-options.js';
import { TimeBudget } from './time-budget.util.js';

class RunOptionsResolver {
  private static readonly DEFAULT_RUNS = 10;
  private static readonly DEFAULT_THRESHOLD = 0.9;
  private static readonly SUBJECT = 'crucible.it options';

  private readonly validator = new RunOptionsValidator();

  validate(candidate: unknown): asserts candidate is RunOptions {
    const violation = this.validator.violation(candidate, RunOptionsResolver.SUBJECT);
    if (violation !== undefined) {
      throw new CrucibleError('usage', violation);
    }
  }

  resolve(opts: RunOptions, defaults: RunOptions = {}): ResolvedRunOptions {
    this.validate(opts);
    const runs = opts.runs ?? defaults.runs ?? RunOptionsResolver.DEFAULT_RUNS;
    return {
      runs,
      threshold: opts.threshold ?? defaults.threshold ?? RunOptionsResolver.DEFAULT_THRESHOLD,
      inferenceTimeout:
        opts.inferenceTimeout ?? defaults.inferenceTimeout ?? TimeBudget.INFERENCE_MS,
      testTimeout: opts.testTimeout ?? defaults.testTimeout ?? TimeBudget.testTimeoutFor(runs),
    };
  }
}

export { RunOptionsResolver };
