import { MalformedFixtureName } from './malformed-fixture-name.enum.js';
import { SpecFixtures } from './spec-fixtures.util.js';
import type { FixtureCase, FixtureFile } from './spec-fixtures.util.js';

class MalformedFixture {
  private static base: FixtureFile = SpecFixtures.compute;
  private static sample: FixtureCase = SpecFixtures.compute.cases[0] as FixtureCase;

  static all(): [MalformedFixtureName, unknown][] {
    return [
      [MalformedFixtureName.TwoOutcomes, MalformedFixture.expecting({ value: 1, text: '1' })],
      [MalformedFixtureName.NoOutcome, MalformedFixture.expecting({})],
      [
        MalformedFixtureName.MessageText,
        MalformedFixture.expecting({ error: { kind: 'usage', message: 'bad runs' } }),
      ],
      [MalformedFixtureName.UnknownKind, MalformedFixture.expecting({ error: { kind: 'fatal' } })],
      [
        MalformedFixtureName.TextRetryable,
        MalformedFixture.expecting({ error: { kind: 'infra', retryable: 'yes' } }),
      ],
      [MalformedFixtureName.NonKebabId, MalformedFixture.withCase({ id: 'Bad_Id' })],
      [MalformedFixtureName.NoDescription, MalformedFixture.withCase({ description: undefined })],
      [MalformedFixtureName.NoCases, { ...MalformedFixture.base, cases: [] }],
      [MalformedFixtureName.ExtraField, { ...MalformedFixture.base, version: 1 }],
      [
        MalformedFixtureName.RetryableOnUsage,
        MalformedFixture.expecting({ error: { kind: 'usage', retryable: false } }),
      ],
      [
        MalformedFixtureName.InfraWithoutRetryable,
        MalformedFixture.expecting({ error: { kind: 'infra' } }),
      ],
      [MalformedFixtureName.EmptyDescription, MalformedFixture.withCase({ description: '' })],
      [MalformedFixtureName.NumericText, MalformedFixture.expecting({ text: 1 })],
      [MalformedFixtureName.NoInput, MalformedFixture.withCase({ input: undefined })],
      [MalformedFixtureName.NonKebabArea, { ...MalformedFixture.base, area: 'Verdict' }],
      [MalformedFixtureName.CasesNotList, { ...MalformedFixture.base, cases: {} }],
      [MalformedFixtureName.NotObject, [MalformedFixture.base]],
    ];
  }

  private static expecting(expectation: unknown): unknown {
    return MalformedFixture.withCase({ expect: expectation });
  }

  private static withCase(changes: Record<string, unknown>): unknown {
    const changed = Object.fromEntries(
      Object.entries({ ...MalformedFixture.sample, ...changes }).filter(
        ([, value]) => value !== undefined,
      ),
    );
    return { ...MalformedFixture.base, cases: [changed] };
  }
}

export { MalformedFixture };
