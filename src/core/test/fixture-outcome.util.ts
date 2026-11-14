import { CrucibleError } from '../errors.js';
import type { CrucibleErrorKind } from '../errors.js';

type FixtureFailure = { kind: CrucibleErrorKind; retryable?: boolean; mustNotContain?: string[] };
type ObservedOutcome = { value: unknown } | { text: unknown } | { error: FixtureFailure };
type ConcealingExpectation = { error?: { mustNotContain?: string[] } };

class FixtureOutcome {
  static async settled(produce: () => unknown, concealed: string[] = []): Promise<ObservedOutcome> {
    try {
      return { value: await produce() };
    } catch (error) {
      return FixtureOutcome.failure(error, concealed);
    }
  }

  static async rendered(
    produce: () => unknown,
    concealed: string[] = [],
  ): Promise<ObservedOutcome> {
    try {
      return { text: await produce() };
    } catch (error) {
      return FixtureOutcome.failure(error, concealed);
    }
  }

  static requireEnoughScript(overran: boolean): void {
    if (overran) {
      throw new Error('the fixture scripts fewer replies than the operation asked for');
    }
  }

  static concealedBy(expectation: unknown): string[] {
    return (expectation as ConcealingExpectation).error?.mustNotContain ?? [];
  }

  private static shown(error: unknown): string[] {
    if (!(error instanceof Error)) {
      return error === undefined ? [] : [String(error)];
    }
    return [error.message, String(error), ...FixtureOutcome.shown(error.cause)];
  }

  private static failure(error: unknown, concealed: string[]): ObservedOutcome {
    if (!(error instanceof CrucibleError)) {
      throw error;
    }
    const shown = FixtureOutcome.shown(error);
    const kept = concealed.filter((secret) => !shown.some((text) => text.includes(secret)));
    const concealment = concealed.length === 0 ? {} : { mustNotContain: kept };
    if (error.retryable === undefined) {
      return { error: { kind: error.kind, ...concealment } };
    }
    return { error: { kind: error.kind, retryable: error.retryable, ...concealment } };
  }
}

export { FixtureOutcome };
export type { ObservedOutcome };
