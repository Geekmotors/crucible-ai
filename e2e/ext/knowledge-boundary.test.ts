import { expect } from '@jest/globals';
import { crucible } from 'crucible-ai';
import scenario from './fixtures/knowledge-boundary.json' with { type: 'json' };
import { Gate } from '../test/gate.enum.js';

crucible.it(
  'holds a character to the knowledge the run state grants her',
  { runs: Gate.Runs, threshold: Gate.Threshold },
  async () => {
    crucible.facts(scenario.state);
    const verdicts = scenario.steps.map((step) => crucible.coherent(step.response, step.claim));
    expect(await Promise.all(verdicts)).toEqual(scenario.steps.map((step) => step.expected));
  },
);
