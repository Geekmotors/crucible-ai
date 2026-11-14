import { expect } from '@jest/globals';
import { crucible } from 'crucible-ai';
import scenario from './fixtures/cjs-smoke.json';
import { Gate } from '../test/gate.enum';

crucible.it('judges through the CommonJS build', { runs: Gate.Smoke }, async () => {
  expect(await crucible.coherent(scenario.response, scenario.claim)).toBe(scenario.expected);
});
