import { CrucibleError } from '../errors.js';
import type { CrucibleErrorKind } from '../errors.js';

type FixtureFailure = { kind: CrucibleErrorKind; retryable?: boolean };
type ObservedOutcome = { value: unknown } | { text: unknown } | { error: FixtureFailure };

class FixtureOutcome {
  static async settled(produce: () => unknown): Promise<ObservedOutcome> {
    try {
      return { value: await produce() };
    } catch (error) {
      return FixtureOutcome.failure(error);
    }
  }

  static async rendered(produce: () => unknown): Promise<ObservedOutcome> {
    try {
      return { text: await produce() };
    } catch (error) {
      return FixtureOutcome.failure(error);
    }
  }

  private static failure(error: unknown): ObservedOutcome {
    if (!(error instanceof CrucibleError)) {
      throw error;
    }
    if (error.retryable === undefined) {
      return { error: { kind: error.kind } };
    }
    return { error: { kind: error.kind, retryable: error.retryable } };
  }
}

export { FixtureOutcome };
export type { ObservedOutcome };
