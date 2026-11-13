import { expect } from '@jest/globals';
import { crucible } from 'crucible-ai';
import scenario from './scenario.json' with { type: 'json' };

crucible.it(scenario.name, { runs: scenario.runs, threshold: scenario.threshold }, async () => {
  crucible.load(scenario.state);
  expect(await crucible.coherent(scenario.response, scenario.claim)).toBe(scenario.expected);
  expect(await crucible.extract(scenario.response, scenario.extract.target)).toBe(
    scenario.extract.expected,
  );
});
