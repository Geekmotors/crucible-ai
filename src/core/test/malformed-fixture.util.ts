import { MalformedFixtureName } from './malformed-fixture-name.enum.js';
import { SpecFixtures } from './spec-fixtures.util.js';
import type { FixtureCase, FixtureFile } from './spec-fixtures.util.js';

class MalformedFixture {
  private static base: FixtureFile = SpecFixtures.compute;

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
      [
        MalformedFixtureName.UnknownInputKey,
        MalformedFixture.withCase({ input: { threshold: 1, statuses: {}, thresold: 1 } }),
      ],
      [
        MalformedFixtureName.MissingInputKey,
        MalformedFixture.withCase({ input: { statuses: {} } }),
      ],
      [
        MalformedFixtureName.MistypedInput,
        MalformedFixture.withCase({ input: { threshold: 1, statuses: { passed: '1' } } }),
      ],
      [MalformedFixtureName.UnknownOperation, { ...MalformedFixture.base, operation: 'tally' }],
      [MalformedFixtureName.OperationInWrongArea, { ...MalformedFixture.base, area: 'report' }],
      [
        MalformedFixtureName.ValueForTextOperation,
        MalformedFixture.inFile(SpecFixtures.render, { expect: { value: 'text' } }),
      ],
      [
        MalformedFixtureName.ZeroExcerptChars,
        MalformedFixture.withRenderInput({
          settings: { excerptChars: 0, verbosity: 'default' },
        }),
      ],
      [
        MalformedFixtureName.RetryWithoutDelay,
        MalformedFixture.inFile(SpecFixtures.trace, {
          input: {
            ...(MalformedFixture.first(SpecFixtures.trace).input as Record<string, unknown>),
            events: [
              {
                event: 'provider-failure',
                attempt: 1,
                cause: { name: 'Error', message: 'flake' },
                next: 'retry',
              },
            ],
          },
        }),
      ],
      [
        MalformedFixtureName.EmptyConcealment,
        MalformedFixture.inFile(SpecFixtures.configLoad, {
          expect: { error: { kind: 'config', mustNotContain: [] } },
        }),
      ],
      [
        MalformedFixtureName.UnknownFileToken,
        MalformedFixture.inFile(SpecFixtures.configLoad, {
          input: { files: { 'crucible.config.json': { $special: 'missing' } } },
        }),
      ],
      [
        MalformedFixtureName.UnknownConfigFile,
        MalformedFixture.inFile(SpecFixtures.configLoad, {
          input: { files: { 'crucible.json': '{}' } },
        }),
      ],
      [
        MalformedFixtureName.ExtractReplyWithoutType,
        MalformedFixture.inFile(SpecFixtures.judgeReply, {
          input: { ask: 'extract', replies: ['{}'] },
        }),
      ],
      [
        MalformedFixtureName.ValueForResponse,
        MalformedFixture.inFile(SpecFixtures.providerResponse, { expect: { value: 'reply' } }),
      ],
      [
        MalformedFixtureName.ResponseWithoutBody,
        MalformedFixture.inFile(SpecFixtures.providerResponse, {
          input: { responses: [{ status: 200 }] },
        }),
      ],
      [
        MalformedFixtureName.UsageErrorForJsonc,
        MalformedFixture.inFile(SpecFixtures.jsoncParse, { expect: { error: { kind: 'usage' } } }),
      ],
      [
        MalformedFixtureName.ErrorForPlainHttpWarning,
        MalformedFixture.inFile(SpecFixtures.providerPlainHttpWarning, {
          expect: { error: { kind: 'config' } },
        }),
      ],
      [
        MalformedFixtureName.TextForPlainHttpWarning,
        MalformedFixture.inFile(SpecFixtures.providerPlainHttpWarning, {
          expect: { value: 'yes' },
        }),
      ],
      [
        MalformedFixtureName.FatalJudgeReply,
        MalformedFixture.inFile(SpecFixtures.judgeReply, {
          expect: { error: { kind: 'infra', retryable: false } },
        }),
      ],
      [
        MalformedFixtureName.ConfigErrorForJudgeReply,
        MalformedFixture.inFile(SpecFixtures.judgeReply, { expect: { error: { kind: 'config' } } }),
      ],
    ];
  }

  private static expecting(expectation: unknown): unknown {
    return MalformedFixture.withCase({ expect: expectation });
  }

  private static withCase(changes: Record<string, unknown>): unknown {
    return MalformedFixture.inFile(MalformedFixture.base, changes);
  }

  private static withRenderInput(changes: Record<string, unknown>): unknown {
    const input = MalformedFixture.first(SpecFixtures.render).input as Record<string, unknown>;
    return MalformedFixture.inFile(SpecFixtures.render, { input: { ...input, ...changes } });
  }

  private static first(file: FixtureFile): FixtureCase {
    return file.cases[0] as FixtureCase;
  }

  private static inFile(file: FixtureFile, changes: Record<string, unknown>): unknown {
    const changed = Object.fromEntries(
      Object.entries({ ...MalformedFixture.first(file), ...changes }).filter(
        ([, value]) => value !== undefined,
      ),
    );
    return { ...file, cases: [changed] };
  }
}

export { MalformedFixture };
