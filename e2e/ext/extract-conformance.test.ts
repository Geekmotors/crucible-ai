import { describe, expect } from '@jest/globals';
import { crucible } from 'crucible';
import type { ExtractType } from 'crucible';
import matrix from './fixtures/extract-conformance.json' with { type: 'json' };
import { ExtractMode } from '../test/extract-mode.enum.js';
import { Gate } from '../test/gate.enum.js';

describe('extract conformance matrix through the public API', () => {
  for (const conformanceCase of matrix.cases) {
    crucible.it(
      `${conformanceCase.id} (${conformanceCase.mode})`,
      { runs: Gate.Smoke },
      async () => {
        crucible.facts(conformanceCase.state);
        const value = await crucible.extract(conformanceCase.response, conformanceCase.target, {
          as: conformanceCase.type as ExtractType,
          strict: conformanceCase.mode === ExtractMode.Strict,
        });
        expect(value).toBe(conformanceCase.expected);
      },
    );
  }
});
