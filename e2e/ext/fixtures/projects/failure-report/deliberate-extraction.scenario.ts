import { expect } from '@jest/globals';
import { crucible } from 'crucible';
import scenario from './extraction.json' with { type: 'json' };

crucible.it(scenario.name, async () => {
  expect(
    await crucible.extract(scenario.response, scenario.target, {
      as: 'number',
      strict: scenario.strict,
    }),
  ).toBe(scenario.insisted);
});
