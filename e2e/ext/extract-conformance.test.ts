import { describe, expect } from '@jest/globals';
import { crucible } from 'crucible-ai';
import type { ExtractType } from 'crucible-ai';
import matrix from './fixtures/extract-conformance.json' with { type: 'json' };
import { Gate } from '../test/gate.enum.js';

describe('extract conformance matrix through the public API', () => {
  for (const conformanceCase of matrix.cases) {
    crucible.it(conformanceCase.id, { runs: Gate.Smoke }, async () => {
      crucible.load(conformanceCase.state);
      const value = await crucible.extract(conformanceCase.response, conformanceCase.target, {
        as: conformanceCase.type as ExtractType,
      });
      expect(value).toBe(conformanceCase.expected);
    });
  }
});
