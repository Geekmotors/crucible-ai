import { CrucibleError } from '../errors.js';
import { JsoncReader } from '../jsonc-reader.util.js';
import { FixtureOutcome } from './fixture-outcome.util.js';
import type { ObservedOutcome } from './fixture-outcome.util.js';

type ParseInput = { text: string };

class JsoncFixtureHarness {
  static parse(input: unknown): Promise<ObservedOutcome> {
    const { text } = input as ParseInput;
    return FixtureOutcome.settled(() => {
      const reading = new JsoncReader().read(text);
      if (!reading.ok) {
        throw new CrucibleError('config', 'not valid JSONC');
      }
      return reading.value;
    });
  }
}

export { JsoncFixtureHarness };
