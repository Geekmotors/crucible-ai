import { expect } from '@jest/globals';
import { crucible } from 'crucible-ai';
import scenario from './fixtures/knowledge-boundary.json' with { type: 'json' };
import { Gate } from '../test/gate.enum.js';

crucible.it(
  'holds a character to the knowledge the run state grants her',
  { runs: Gate.Runs, threshold: Gate.Threshold },
  async () => {
    crucible.load(scenario.state);
    for (const step of scenario.steps) {
      expect(await crucible.coherent(step.response, step.claim)).toBe(step.expected);
    }
  },
);
