import { CrucibleError } from './errors.js';
import type { ResolvedRunOptions, RunOptions } from './run-options.js';

class RunOptionsResolver {
  private static readonly DEFAULT_RUNS = 1;
  private static readonly DEFAULT_THRESHOLD = 1;
  private static readonly KNOWN_KEYS: ReadonlySet<string> = new Set(['runs', 'threshold']);

  validate(opts: RunOptions): void {
    if (typeof opts !== 'object' || opts === null || Array.isArray(opts)) {
      throw new CrucibleError('usage', 'crucible.it options must be an object.');
    }
    for (const key of Object.keys(opts)) {
      if (!RunOptionsResolver.KNOWN_KEYS.has(key)) {
        throw new CrucibleError(
          'usage',
          `Unknown crucible.it option "${key}". Supported options: ${[...RunOptionsResolver.KNOWN_KEYS].join(', ')}.`,
        );
      }
    }
    if (opts.runs !== undefined && !this.isValidRuns(opts.runs)) {
      throw new CrucibleError(
        'usage',
        `crucible.it option "runs" must be an integer of at least 1; received ${String(opts.runs)}.`,
      );
    }
    if (opts.threshold !== undefined && !this.isValidThreshold(opts.threshold)) {
      throw new CrucibleError(
        'usage',
        `crucible.it option "threshold" must be a number greater than 0 and at most 1; received ${String(opts.threshold)}.`,
      );
    }
  }

  resolve(opts: RunOptions): ResolvedRunOptions {
    this.validate(opts);
    return {
      runs: opts.runs ?? RunOptionsResolver.DEFAULT_RUNS,
      threshold: opts.threshold ?? RunOptionsResolver.DEFAULT_THRESHOLD,
    };
  }

  private isValidRuns(runs: unknown): boolean {
    return typeof runs === 'number' && Number.isInteger(runs) && runs >= 1;
  }

  private isValidThreshold(threshold: unknown): boolean {
    return typeof threshold === 'number' && threshold > 0 && threshold <= 1;
  }
}

export { RunOptionsResolver };
