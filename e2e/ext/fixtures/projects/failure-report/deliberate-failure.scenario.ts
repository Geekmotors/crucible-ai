import { expect } from '@jest/globals';
import { crucible } from 'crucible';
import scenario from './scenario.json' with { type: 'json' };

crucible.it(scenario.name, async () => {
  expect(await crucible.coherent(scenario.response, scenario.claim, { facts: scenario.fact })).toBe(
    scenario.insisted,
  );
});
