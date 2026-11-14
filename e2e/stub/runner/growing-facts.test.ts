import { expect } from '@jest/globals';
import { crucible } from 'crucible-ai';
import scenario from './fixtures/growing-facts.json' with { type: 'json' };

crucible.it(scenario.name, { runs: scenario.runs, threshold: scenario.threshold }, async () => {
  crucible.facts(scenario.state);
  const verdicts = scenario.steps.map((step) => {
    crucible.facts(step.append);
    return crucible.coherent(step.response, step.claim);
  });
  expect(await Promise.all(verdicts)).toEqual(scenario.steps.map((step) => step.expected));
});
