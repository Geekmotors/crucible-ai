import { CrucibleError } from './errors.js';
import { RunOptionsValidator } from './run-options-validator.util.js';
import type { Invocation, ResolvedRunOptions, RunOptions } from './run-options.js';
import { TimeBudget } from './time-budget.util.js';

class RunOptionsResolver {
  private static readonly DEFAULT_RUNS = 10;
  private static readonly DEFAULT_THRESHOLD = 0.9;
  private static readonly DEFAULT_STRICT = false;
  private static readonly DEFAULT_MEASURE = false;
  private static readonly SUBJECT = 'crucible.it options';

  private readonly validator = new RunOptionsValidator();

  validate(candidate: unknown): asserts candidate is RunOptions {
    const violation = this.validator.violation(candidate, RunOptionsResolver.SUBJECT);
    if (violation !== undefined) {
      throw new CrucibleError('usage', violation);
    }
  }

  resolve(
    opts: RunOptions,
    defaults: RunOptions = {},
    invocation: Invocation = {},
  ): ResolvedRunOptions {
    this.validate(opts);
    const runs = opts.runs ?? defaults.runs ?? RunOptionsResolver.DEFAULT_RUNS;
    const declaredTimeout = opts.testTimeout ?? defaults.testTimeout;
    const gating = {
      runs,
      threshold: opts.threshold ?? defaults.threshold ?? RunOptionsResolver.DEFAULT_THRESHOLD,
      inferenceTimeout:
        opts.inferenceTimeout ?? defaults.inferenceTimeout ?? TimeBudget.INFERENCE_MS,
      testTimeout: declaredTimeout ?? TimeBudget.testTimeoutFor(runs),
      strict: opts.strict ?? defaults.strict ?? RunOptionsResolver.DEFAULT_STRICT,
    };
    const measure =
      invocation.mode === 'measure' ||
      (opts.measure ?? defaults.measure ?? RunOptionsResolver.DEFAULT_MEASURE);
    if (!measure) {
      return { ...gating, measure };
    }
    const measureRuns = invocation.measureRuns ?? runs;
    const measuredTimeout = TimeBudget.testTimeoutFor(measureRuns);
    return {
      ...gating,
      testTimeout: Math.max(declaredTimeout ?? measuredTimeout, measuredTimeout),
      measure,
      measureRuns,
    };
  }
}

export { RunOptionsResolver };
