import { TimeBudget } from './time-budget.util.js';

class RunOptionsValidator {
  private static readonly KNOWN_KEYS: ReadonlySet<string> = new Set([
    'runs',
    'threshold',
    'inferenceTimeout',
    'testTimeout',
  ]);

  violation(candidate: unknown, subject: string): string | undefined {
    if (typeof candidate !== 'object' || candidate === null || Array.isArray(candidate)) {
      return `${subject} must be an object.`;
    }
    const opts = candidate as Record<string, unknown>;
    const unknown = Object.keys(opts).find((key) => !RunOptionsValidator.KNOWN_KEYS.has(key));
    if (unknown !== undefined) {
      return `Unknown option "${unknown}" in ${subject}. Supported options: ${[...RunOptionsValidator.KNOWN_KEYS].join(', ')}.`;
    }
    if (opts.runs !== undefined && !this.isValidRuns(opts.runs)) {
      return `"runs" in ${subject} must be an integer of at least 1; received ${String(opts.runs)}.`;
    }
    if (opts.threshold !== undefined && !this.isValidThreshold(opts.threshold)) {
      return `"threshold" in ${subject} must be a number greater than 0 and at most 1; received ${String(opts.threshold)}.`;
    }
    const badTimeout = ['inferenceTimeout', 'testTimeout'].find(
      (key) => opts[key] !== undefined && !TimeBudget.isValidTimeout(opts[key]),
    );
    if (badTimeout !== undefined) {
      return `"${badTimeout}" in ${subject} must be an integer number of milliseconds from 1 to ${TimeBudget.TIMER_MAX_MS}; received ${String(opts[badTimeout])}.`;
    }
    return undefined;
  }

  private isValidRuns(runs: unknown): boolean {
    return typeof runs === 'number' && Number.isInteger(runs) && runs >= 1;
  }

  private isValidThreshold(threshold: unknown): boolean {
    return typeof threshold === 'number' && threshold > 0 && threshold <= 1;
  }
}

export { RunOptionsValidator };
