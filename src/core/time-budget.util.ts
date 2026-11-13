class TimeBudget {
  static readonly INFERENCE_MS = 30000;
  static readonly TIMER_MAX_MS = 2147483647;
  private static readonly TEST_BASE_MS = 30000;
  private static readonly PER_EXTRA_RUN_MS = 1000;

  static testTimeoutFor(runs: number): number {
    return Math.min(
      TimeBudget.TIMER_MAX_MS,
      TimeBudget.TEST_BASE_MS + (runs - 1) * TimeBudget.PER_EXTRA_RUN_MS,
    );
  }

  static isValidTimeout(value: unknown): boolean {
    return (
      typeof value === 'number' &&
      Number.isInteger(value) &&
      value >= 1 &&
      value <= TimeBudget.TIMER_MAX_MS
    );
  }
}

export { TimeBudget };
