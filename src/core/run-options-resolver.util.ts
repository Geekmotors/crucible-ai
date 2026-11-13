import { CrucibleError } from './errors.js';
import { RunOptionsValidator } from './run-options-validator.util.js';
import type { ResolvedRunOptions, RunOptions } from './run-options.js';

class RunOptionsResolver {
  private static readonly DEFAULT_RUNS = 1;
  private static readonly DEFAULT_THRESHOLD = 1;
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
    return {
      runs: opts.runs ?? defaults.runs ?? RunOptionsResolver.DEFAULT_RUNS,
      threshold: opts.threshold ?? defaults.threshold ?? RunOptionsResolver.DEFAULT_THRESHOLD,
    };
  }
}

export { RunOptionsResolver };
