import type { RunStatus } from './run-result.js';

type VerdictOutcome = 'failed' | 'errored';

class CrucibleVerdictError extends Error {
  readonly outcome: VerdictOutcome;
  readonly runStatuses: readonly RunStatus[];

  constructor(
    outcome: VerdictOutcome,
    message: string,
    cause: unknown,
    runStatuses: readonly RunStatus[] = [],
  ) {
    super(message, cause !== undefined ? { cause } : undefined);
    this.name = 'CrucibleVerdictError';
    this.outcome = outcome;
    this.runStatuses = Object.freeze([...runStatuses]);
  }
}

export { CrucibleVerdictError };
export type { VerdictOutcome };
