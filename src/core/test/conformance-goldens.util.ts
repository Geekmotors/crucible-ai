import { isDeepStrictEqual } from 'node:util';
import coherentCases from '../../../e2e/ext/fixtures/coherent-conformance.json' with { type: 'json' };
import extractCases from '../../../e2e/ext/fixtures/extract-conformance.json' with { type: 'json' };
import { SpecFixtures } from './spec-fixtures.util.js';
import type { FixtureFile } from './spec-fixtures.util.js';

type GoldenInput = { id: string; input: unknown };

class ConformanceGoldens {
  static drift(): string[] {
    return [
      ...ConformanceGoldens.compare(
        SpecFixtures.coherentConformance,
        coherentCases.cases.map(({ id, state, response, claim }) => ({
          id: `payload-coherent-conformance-${id}`,
          input: { facts: state, response, claim },
        })),
      ),
      ...ConformanceGoldens.compare(
        SpecFixtures.extractConformance,
        extractCases.cases.map(({ id, state, response, target, type, mode }) => ({
          id: `payload-extract-conformance-${id}`,
          input: { facts: state, response, target, type, mode },
        })),
      ),
    ];
  }

  private static plain(inputs: GoldenInput[]): GoldenInput[] {
    return JSON.parse(JSON.stringify(inputs)) as GoldenInput[];
  }

  private static compare(golden: FixtureFile, wanted: GoldenInput[]): string[] {
    const current = ConformanceGoldens.plain(wanted);
    const committed = ConformanceGoldens.plain(
      golden.cases.map(({ id, input }) => ({ id, input })),
    );
    const missing = current.filter(
      (want) => !committed.some((held) => isDeepStrictEqual(held, want)),
    );
    const extra = committed.filter(
      (held) => !current.some((want) => isDeepStrictEqual(held, want)),
    );
    return [...missing, ...extra].map(({ id }) => id);
  }
}

export { ConformanceGoldens };
