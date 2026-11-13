type VerdictOutcome = 'failed' | 'errored';

class CrucibleVerdictError extends Error {
  readonly outcome: VerdictOutcome;

  constructor(outcome: VerdictOutcome, message: string, cause: unknown) {
    super(message, cause !== undefined ? { cause } : undefined);
    this.name = 'CrucibleVerdictError';
    this.outcome = outcome;
  }
}

export { CrucibleVerdictError };
export type { VerdictOutcome };
