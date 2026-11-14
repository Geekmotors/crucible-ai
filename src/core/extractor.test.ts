import { describe, expect, it } from '@jest/globals';
import { CrucibleError } from './errors.js';
import { RunScope } from './state.js';
import { Capture } from './test/capture.util.js';
import { ExpiredDeadline } from './test/expired-deadline.fake.js';
import { ExtractReasoning } from './test/extract-reasoning.enum.js';
import { ExtractReply } from './test/extract-reply.enum.js';
import { ExtractTarget } from './test/extract-target.enum.js';
import { ExtractText } from './test/extract-text.enum.js';
import { ExtractValue } from './test/extract-value.enum.js';
import { ExtractModeName } from './test/extract-mode-name.enum.js';
import { ExtractorHarness } from './test/extractor-harness.util.js';
import { TraceHarness } from './test/trace-harness.util.js';
import { VerbosityLevel } from './test/verbosity-level.enum.js';
import { FactsHarness } from './test/facts-harness.util.js';
import { OptionsHarness } from './test/options-harness.util.js';
import { StateFact } from './test/state-fact.enum.js';

describe('Extractor — typed values', () => {
  it('resolves the number the judge extracted when a number is requested', async () => {
    await expect(ExtractorHarness.extracted(ExtractReply.Two, { as: 'number' })).resolves.toBe(
      ExtractValue.Two,
    );
  });

  it('resolves a string by default', async () => {
    await expect(ExtractorHarness.extracted(ExtractReply.City)).resolves.toBe(ExtractText.City);
  });

  it('resolves a boolean when a boolean is requested', async () => {
    await expect(ExtractorHarness.extracted(ExtractReply.Booked, { as: 'boolean' })).resolves.toBe(
      true,
    );
  });

  it('resolves null when the judge finds no single committed value', async () => {
    await expect(
      ExtractorHarness.extracted(ExtractReply.Hedged, { as: 'number' }),
    ).resolves.toBeNull();
  });

  it('accepts a reply wrapped in a markdown code fence', async () => {
    await expect(
      ExtractorHarness.extracted('```json\n' + ExtractReply.Two + '\n```', { as: 'number' }),
    ).resolves.toBe(ExtractValue.Two);
  });
});

describe('Extractor — lenient or strict', () => {
  it('extracts leniently by default, taking the value the reply leans to', async () => {
    await expect(ExtractorHarness.leaning({ as: 'number' })).resolves.toBe(ExtractValue.Two);
  });

  it('extracts strictly when the call asks for it', async () => {
    await expect(ExtractorHarness.leaning({ as: 'number', strict: true })).resolves.toBeNull();
  });

  it('extracts strictly when the run resolved strict', async () => {
    await expect(ExtractorHarness.leaning({ as: 'number' }, true)).resolves.toBeNull();
  });

  it('extracts leniently when the run resolved lenient', async () => {
    await expect(ExtractorHarness.leaning({ as: 'number' }, false)).resolves.toBe(ExtractValue.Two);
  });
});

describe('Extractor — unusable judge replies', () => {
  it('re-asks once when the value does not match the requested type, and accepts a valid second reply', async () => {
    await expect(
      ExtractorHarness.extractedFrom([ExtractReply.TwoAsText, ExtractReply.Two], { as: 'number' }),
    ).resolves.toBe(ExtractValue.Two);
  });

  it.each([
    ['a value of the wrong type', ExtractReply.TwoAsText],
    ['a non-finite number', ExtractReply.Infinite],
    ['no value', ExtractReply.NoValue],
    ['no reasoning', ExtractReply.NoReasoning],
    ['no JSON at all', ExtractReply.NotJson],
  ])('a reply with %s, twice, is a retryable infra error', async (_label, reply) => {
    const error = await ExtractorHarness.failure(reply, { as: 'number' });
    expect(error).toBeInstanceOf(CrucibleError);
    expect((error as CrucibleError).kind).toBe('infra');
    expect((error as CrucibleError).retryable).toBe(true);
  });

  it('a string value is the wrong type for a boolean request', async () => {
    const error = await ExtractorHarness.failure(ExtractReply.City, { as: 'boolean' });
    expect((error as CrucibleError).kind).toBe('infra');
  });

  it('an unusable reply after the re-ask leaves an ErrorRecord readable within the run', async () => {
    const context = await ExtractorHarness.recordedContext(
      [ExtractReply.NotJson, ExtractReply.NotJson],
      { as: 'number' },
    );
    expect(context.errors).toHaveLength(1);
    expect(context.extractions).toHaveLength(0);
  });

  it('a judge call that outlives its deadline errors as retryable infra', async () => {
    const scope = new RunScope();
    const extractor = ExtractorHarness.extractor(
      ExtractorHarness.scripted([ExtractReply.Two]),
      scope,
      new ExpiredDeadline().signal,
    );
    const error = await scope.enterRun(() =>
      Capture.rejection(extractor.extract(ExtractText.Response, ExtractTarget.Apples)),
    );
    expect((error as CrucibleError).kind).toBe('infra');
    expect((error as CrucibleError).retryable).toBe(true);
  });
});

describe('Extractor — usage', () => {
  it.each([
    ['a non-string text', undefined, ExtractTarget.Apples, undefined],
    ['a non-string description', ExtractText.Response, 42, undefined],
    ['an unknown type', ExtractText.Response, ExtractTarget.Apples, { as: 'date' }],
    ['options that are not an object', ExtractText.Response, ExtractTarget.Apples, 'number'],
    ['null options', ExtractText.Response, ExtractTarget.Apples, null],
    ['a null type', ExtractText.Response, ExtractTarget.Apples, { as: null }],
    ['a string strict', ExtractText.Response, ExtractTarget.Apples, { strict: String(true) }],
    ['a null strict', ExtractText.Response, ExtractTarget.Apples, { strict: null }],
    ['an unknown option', ExtractText.Response, ExtractTarget.Apples, { strcit: true }],
    ...FactsHarness.invalid().map(
      ([label, facts]) =>
        [`${label} as facts`, ExtractText.Response, ExtractTarget.Apples, { facts }] as const,
    ),
    ...OptionsHarness.nonPlain().map(
      ([label, options]) => [label, ExtractText.Response, ExtractTarget.Apples, options] as const,
    ),
  ])('rejects %s as a usage error', async (_label, text, description, options) => {
    const error = await ExtractorHarness.usageFailure(text, description, options);
    expect(error).toBeInstanceOf(CrucibleError);
    expect((error as CrucibleError).kind).toBe('usage');
  });

  it('extracting outside a run scope is a usage error', async () => {
    const extractor = ExtractorHarness.extractor(
      ExtractorHarness.scripted([ExtractReply.Two]),
      new RunScope(),
    );
    const error = await Capture.rejection(
      extractor.extract(ExtractText.Response, ExtractTarget.Apples),
    );
    expect((error as CrucibleError).kind).toBe('usage');
  });
});

describe('Extractor — facts', () => {
  it('extracts against the run facts followed by the call’s own facts', async () => {
    const scope = new RunScope();
    const extractor = ExtractorHarness.factExtractor(scope, [StateFact.Casino, StateFact.Home]);
    const value = await scope.enterRun(() => {
      scope.appendState(StateFact.Casino);
      return extractor.extract(ExtractText.Response, ExtractTarget.Apples, {
        as: 'number',
        facts: [StateFact.Home],
      });
    });
    expect(value).toBe(ExtractValue.Two);
  });

  it('sends a single per-call fact when the run has none', async () => {
    const scope = new RunScope();
    const extractor = ExtractorHarness.factExtractor(scope, [StateFact.Letter]);
    const value = await scope.enterRun(() =>
      extractor.extract(ExtractText.Response, ExtractTarget.Apples, {
        as: 'number',
        facts: StateFact.Letter,
      }),
    );
    expect(value).toBe(ExtractValue.Two);
  });

  it('a later call does not see an earlier call’s facts', async () => {
    const scope = new RunScope();
    const extractor = ExtractorHarness.factExtractor(scope, [StateFact.Casino]);
    const value = await scope.enterRun(async () => {
      scope.appendState(StateFact.Casino);
      await extractor.extract(ExtractText.Response, ExtractTarget.Apples, {
        as: 'number',
        facts: StateFact.Home,
      });
      return extractor.extract(ExtractText.Response, ExtractTarget.Apples, { as: 'number' });
    });
    expect(value).toBe(ExtractValue.Two);
  });

  it('extracts against the facts as given when the caller mutates its array mid-call', async () => {
    const scope = new RunScope();
    const extractor = ExtractorHarness.factExtractor(scope, [StateFact.Home]);
    const value = await scope.enterRun(() => {
      const facts = [StateFact.Home];
      const pending = extractor.extract(ExtractText.Response, ExtractTarget.Apples, {
        as: 'number',
        facts,
      });
      facts.push(StateFact.Letter);
      return pending;
    });
    expect(value).toBe(ExtractValue.Two);
  });

  it('per-call facts never enter the run’s facts', async () => {
    const scope = new RunScope();
    const extractor = ExtractorHarness.factExtractor(scope, [StateFact.Casino]);
    const state = await scope.enterRun(async () => {
      scope.appendState(StateFact.Casino);
      await extractor.extract(ExtractText.Response, ExtractTarget.Apples, {
        facts: StateFact.Home,
      });
      return scope.context().state;
    });
    expect(state).toEqual([StateFact.Casino]);
  });

  it('records the facts each extraction used', async () => {
    const scope = new RunScope();
    const extractor = ExtractorHarness.factExtractor(scope, [StateFact.Casino]);
    const extractions = await scope.enterRun(async () => {
      scope.appendState(StateFact.Casino);
      await extractor.extract(ExtractText.Response, ExtractTarget.Apples, {
        as: 'number',
        facts: StateFact.Home,
      });
      await extractor.extract(ExtractText.Response, ExtractTarget.Apples, { as: 'number' });
      return scope.context().extractions;
    });
    expect(extractions.map((record) => record.facts)).toEqual([
      [StateFact.Casino, StateFact.Home],
      [StateFact.Casino],
    ]);
  });
});

describe('Extractor — records and trace', () => {
  it('records the extraction within the run', async () => {
    const context = await ExtractorHarness.recordedContext([ExtractReply.Hedged], { as: 'number' });
    expect(context.extractions).toEqual([
      expect.objectContaining({
        description: ExtractTarget.Apples,
        type: 'number',
        value: null,
        reasoning: ExtractReasoning.Hedged,
        response: ExtractText.Response,
      }),
    ]);
  });

  it('records the default string type when no type is requested', async () => {
    const context = await ExtractorHarness.recordedContext([ExtractReply.City]);
    expect(context.extractions[0]?.type).toBe('string');
  });

  it('traces the extracted value with its description and type', async () => {
    const output = await ExtractorHarness.tracedOutput([ExtractReply.Two], new TraceHarness());
    expect(output).toContain(`judge value 2 for extract "${ExtractTarget.Apples}" as number`);
  });

  it('traces the mode the extraction used', async () => {
    const output = await ExtractorHarness.tracedOutput([ExtractReply.Two], new TraceHarness());
    expect(output).toContain(`as number (${ExtractModeName.Lenient})`);
  });

  it('traces an unusable reply before the re-ask', async () => {
    const output = await ExtractorHarness.tracedOutput(
      [ExtractReply.TwoAsText, ExtractReply.Two],
      new TraceHarness(),
    );
    expect(output).toContain('judge reply 1 unusable');
  });

  it('writes nothing below debug verbosity', async () => {
    await expect(
      ExtractorHarness.tracedOutput([ExtractReply.Two], new TraceHarness(VerbosityLevel.Full)),
    ).resolves.toBe('');
  });
});
