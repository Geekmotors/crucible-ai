import { expect } from '@jest/globals';
import { crucible } from 'crucible-ai';
import scenario from './fixtures/room-booking.json' with { type: 'json' };
import { Gate } from '../test/gate.enum.js';

crucible.it(
  'judges replies against loaded and appended run state',
  { runs: Gate.Runs, threshold: Gate.Threshold },
  async () => {
    crucible.load(scenario.state);
    const verdicts = scenario.steps.map((step) => {
      crucible.append(step.append);
      return crucible.coherent(step.response, step.claim);
    });
    expect(await Promise.all(verdicts)).toEqual(scenario.steps.map((step) => step.expected));
  },
);
