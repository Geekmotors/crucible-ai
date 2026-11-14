import { expect } from '@jest/globals';
import { crucible } from 'crucible';
import scenario from './fixtures/room-booking.json' with { type: 'json' };
import { Gate } from '../test/gate.enum.js';

crucible.it(
  'judges replies against the run facts as they grow',
  { runs: Gate.Runs, threshold: Gate.Threshold },
  async () => {
    crucible.facts(scenario.state);
    const verdicts = scenario.steps.map((step) => {
      crucible.facts(step.append);
      return crucible.coherent(step.response, step.claim);
    });
    expect(await Promise.all(verdicts)).toEqual(scenario.steps.map((step) => step.expected));
  },
);
