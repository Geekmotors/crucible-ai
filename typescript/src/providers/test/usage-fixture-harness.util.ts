import { FixtureOutcome } from '../../core/test/fixture-outcome.util.js';
import type { ObservedOutcome } from '../../core/test/fixture-outcome.util.js';
import { UsageReader } from '../usage-reader.util.js';

type UsageInput = { json: unknown };

class UsageFixtureHarness {
  static read(input: unknown): Promise<ObservedOutcome> {
    const { json } = input as UsageInput;
    return FixtureOutcome.settled(() => new UsageReader().read(json));
  }
}

export { UsageFixtureHarness };
