import { expect } from '@jest/globals';
import { crucible } from 'crucible-ai';
import scenario from './fixtures/room-booking.json' with { type: 'json' };
import { Gate } from '../test/gate.enum.js';

crucible.it(
  'judges replies against loaded and appended run state',
  { runs: Gate.Runs, threshold: Gate.Threshold },
  async () => {
    crucible.load(scenario.state);
    for (const step of scenario.steps) {
      crucible.append(step.append);
      expect(await crucible.coherent(step.response, step.claim)).toBe(step.expected);
    }
  },
);
