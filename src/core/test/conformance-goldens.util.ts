import { isDeepStrictEqual } from 'node:util';
import coherentCases from '../../../e2e/ext/fixtures/coherent-conformance.json' with { type: 'json' };
import extractCases from '../../../e2e/ext/fixtures/extract-conformance.json' with { type: 'json' };
import harnessConfig from '../../../e2e/crucible.config.json' with { type: 'json' };
import { SpecFixtures } from './spec-fixtures.util.js';
import type { FixtureCase, FixtureFile } from './spec-fixtures.util.js';

type GoldenInput = { id: string; input: unknown };

type RequestGoldenInput = { config: unknown; prompt: string };

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

  static requestDrift(): string[] {
    const suites = [
      {
        suite: 'coherent',
        first: coherentCases.cases[0]?.id,
        payloads: SpecFixtures.coherentConformance,
      },
      {
        suite: 'extract',
        first: extractCases.cases[0]?.id,
        payloads: SpecFixtures.extractConformance,
      },
    ];
    const goldens = SpecFixtures.providerRequestConformance.cases;
    const unknownSuite = goldens
      .filter(
        ({ id }) =>
          !suites.some(({ suite }) => id.startsWith(ConformanceGoldens.requestPrefix(suite))),
      )
      .map(({ id }) => id);
    return [
      ...unknownSuite,
      ...suites.flatMap(({ suite, first, payloads }) =>
        ConformanceGoldens.requestDriftOf(
          suite,
          goldens.filter(({ id }) => id.startsWith(ConformanceGoldens.requestPrefix(suite))),
          payloads.cases.find(({ id }) => id === `payload-${suite}-conformance-${first}`)?.expect,
        ),
      ),
    ];
  }

  private static requestPrefix(suite: string): string {
    return `provider-request-conformance-${suite}-`;
  }

  private static requestDriftOf(suite: string, goldens: FixtureCase[], payload: unknown): string[] {
    const harnessId = `${ConformanceGoldens.requestPrefix(suite)}harness-config`;
    const harnessCase = goldens.find(({ id }) => id === harnessId);
    const missingHarness =
      harnessCase === undefined ||
      !ConformanceGoldens.same((harnessCase.input as RequestGoldenInput).config, harnessConfig)
        ? [harnessId]
        : [];
    const stalePrompts = goldens
      .filter(
        ({ input }) =>
          !ConformanceGoldens.same({ text: (input as RequestGoldenInput).prompt }, payload),
      )
      .map(({ id }) => id);
    return [...missingHarness, ...stalePrompts];
  }

  private static same(left: unknown, right: unknown): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
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
