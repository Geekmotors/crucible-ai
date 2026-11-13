import { expect } from '@jest/globals';
import { crucible } from 'crucible-ai';
import scenario from './scenario.json' with { type: 'json' };

crucible.it(scenario.name, async () => {
  crucible.load(scenario.state);
  expect(await crucible.coherent(scenario.response, scenario.claim)).toBe(scenario.expected);
});
