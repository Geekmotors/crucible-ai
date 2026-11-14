import { describe, expect } from '@jest/globals';
import { crucible } from 'crucible-ai';
import matrix from './fixtures/coherent-conformance.json' with { type: 'json' };
import { Gate } from '../test/gate.enum.js';

describe('coherent conformance matrix through the public API', () => {
  for (const conformanceCase of matrix.cases) {
    crucible.it(conformanceCase.id, { runs: Gate.Smoke }, async () => {
      crucible.facts(conformanceCase.state);
      expect(await crucible.coherent(conformanceCase.response, conformanceCase.claim)).toBe(
        conformanceCase.expected,
      );
    });
  }
});
