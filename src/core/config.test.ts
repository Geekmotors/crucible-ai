import { describe, expect, it } from '@jest/globals';
import { ConfigHarness } from './test/config-harness.util.js';
import { ConfigFileName } from './test/config-file-name.enum.js';
import { ConfigSchemaHarness } from './test/config-schema-harness.util.js';
import { ConfigText } from './test/config-text.enum.js';
import { LeakedSecret } from './test/leaked-secret.enum.js';
import { ReadFailure } from './test/read-failure.enum.js';
import { ApiKey } from '../providers/test/api-key.enum.js';
import { BaseUrl } from '../providers/test/base-url.enum.js';
import { ChatAdapterHarness } from '../providers/test/chat-adapter-harness.util.js';
import { EndpointUrl } from '../providers/test/endpoint-url.enum.js';
import { FakeEnvironment } from '../providers/test/environment.fake.js';
import { FakeFetchBoundary } from '../providers/test/fetch-boundary.fake.js';
import { KeyEnv } from '../providers/test/key-env.enum.js';
import { InvalidBaseUrl } from './test/invalid-base-url.enum.js';
import { InvalidKeyEnv } from './test/invalid-key-env.enum.js';
import { ROUTING_META } from '../providers/test/routing-meta.fake.js';
import { TestModel } from '../providers/test/test-model.enum.js';
import { ExcerptChars } from './test/excerpt-chars.enum.js';
import { InvalidExcerptChars } from './test/invalid-excerpt-chars.enum.js';
import { CustomTimeout } from './test/custom-timeout.enum.js';
import { InvalidTestDefault } from './test/invalid-test-default.enum.js';
import { InvalidTimeout } from './test/invalid-timeout.enum.js';
import { RunCount } from './test/run-count.enum.js';
import { Threshold } from './test/threshold.enum.js';
import { ProviderName } from '../providers/test/provider-name.enum.js';

describe('ConfigStore with a valid config', () => {
  it('resolves the registered adapter, model, meta, and verbosity', () => {
    const store = ConfigHarness.store({
      provider: 'fake',
      model: TestModel.DeepseekV3,
      meta: ROUTING_META,
      verbosity: 'full',
    });
    const config = store.get();
    expect(config.provider).toBe(ConfigHarness.fakeAdapter);
    expect(config.model).toBe(TestModel.DeepseekV3);
    expect(config.meta).toEqual(ROUTING_META);
    expect(config.effectiveVerbosity).toBe('full');
  });

  it('applies defaults when optional fields are omitted', () => {
    const config = ConfigHarness.store({ provider: 'fake', model: TestModel.Generic }).get();
    expect(config.meta).toBeUndefined();
    expect(config.effectiveVerbosity).toBe('default');
  });

  it('passes meta through untouched, nested content included', () => {
    const meta = { anything: { nested: [1, 2, 3] }, routing: 'weird' };
    expect(
      ConfigHarness.store({ provider: 'fake', model: TestModel.Generic, meta }).get().meta,
    ).toEqual(meta);
  });

  it('memoizes: repeated gets return the same config instance', () => {
    const store = ConfigHarness.store({ provider: 'fake', model: TestModel.Generic });
    expect(store.get()).toBe(store.get());
  });

  it('accepts a config file that starts with a UTF-8 byte-order mark', () => {
    const raw = '﻿' + JSON.stringify({ provider: 'fake', model: TestModel.Generic });
    expect(ConfigHarness.store(raw).get().model).toBe(TestModel.Generic);
  });
});

describe('ConfigStore rejects invalid configs as config failures', () => {
  it.each([
    ['unknown provider', { provider: 'nope', model: TestModel.Generic }],
    ['missing provider', { model: TestModel.Generic }],
    ['whitespace provider', { provider: '  ', model: TestModel.Generic }],
    ['missing model', { provider: 'fake' }],
    ['empty model', { provider: 'fake', model: '' }],
    ['whitespace model', { provider: 'fake', model: '   ' }],
    ['non-string model', { provider: 'fake', model: 42 }],
    ['non-object meta', { provider: 'fake', model: TestModel.Generic, meta: 'nope' }],
    ['unknown field', { provider: 'fake', model: TestModel.Generic, defaults: {} }],
    ['invalid verbosity', { provider: 'fake', model: TestModel.Generic, verbosity: 'quiet' }],
    ['malformed JSON', '{ not json !!!'],
    ['non-object root', '["array"]'],
  ])('%s', (_label, configValue) => {
    expect(ConfigHarness.errorKind(ConfigHarness.store(configValue))).toBe('config');
  });

  it.each(['apiKey', 'API_KEY', 'Key', 'token', 'secret', 'Authorization'])(
    'key-like field "%s" is rejected regardless of casing',
    (field) => {
      expect(
        ConfigHarness.errorKind(
          ConfigHarness.store({ provider: 'fake', model: TestModel.Generic, [field]: 'sk' }),
        ),
      ).toBe('config');
    },
  );

  it('a missing config file is a config failure', () => {
    expect(ConfigHarness.errorKind(ConfigHarness.storeWithFiles({}))).toBe('config');
  });

  it('an unreadable config file is a config failure', () => {
    const store = ConfigHarness.storeWithFiles({
      [ConfigFileName.Json]: {
        found: false,
        reason: 'unreadable',
        detail: ReadFailure.PermissionDenied,
      },
    });
    expect(ConfigHarness.errorKind(store)).toBe('config');
  });
});

describe('ConfigStore reads either config file name as JSON with comments', () => {
  it.each([ConfigFileName.Json, ConfigFileName.Jsonc])(
    'reads %s with comments and trailing commas',
    (name) => {
      const store = ConfigHarness.storeWithFiles({
        [name]: ConfigHarness.found(ConfigText.CommentedJsonc),
      });
      expect(store.get().model).toBe(TestModel.Generic);
    },
  );

  it('accepts and ignores a "$schema" reference', () => {
    expect(ConfigHarness.store(ConfigText.WithSchemaReference).get().model).toBe(TestModel.Generic);
  });

  it('both config files present is a config failure', () => {
    const raw = JSON.stringify({ provider: 'fake', model: TestModel.Generic });
    const store = ConfigHarness.storeWithFiles({
      [ConfigFileName.Json]: ConfigHarness.found(raw),
      [ConfigFileName.Jsonc]: ConfigHarness.found(raw),
    });
    expect(ConfigHarness.errorKind(store)).toBe('config');
  });

  it('an unreadable second config file is a config failure', () => {
    const store = ConfigHarness.storeWithFiles({
      [ConfigFileName.Json]: {
        found: false,
        reason: 'unreadable',
        detail: ReadFailure.PermissionDenied,
      },
      [ConfigFileName.Jsonc]: ConfigHarness.found(ConfigText.CommentedJsonc),
    });
    expect(ConfigHarness.errorKind(store)).toBe('config');
  });

  it('an unterminated comment is a config failure', () => {
    expect(ConfigHarness.errorKind(ConfigHarness.store(ConfigText.UnterminatedComment))).toBe(
      'config',
    );
  });

  it('a malformed file never echoes its content', () => {
    expect(
      ConfigHarness.revealsInError(
        ConfigHarness.store(ConfigText.MalformedWithKey),
        LeakedSecret.InMalformedConfig,
      ),
    ).toBe(false);
  });
});

describe('ConfigStore verbosity override', () => {
  it('the override wins over the configured verbosity', () => {
    const store = ConfigHarness.store(
      { provider: 'fake', model: TestModel.Generic, verbosity: 'default' },
      'debug',
    );
    expect(store.get().effectiveVerbosity).toBe('debug');
  });

  it('an empty override falls back to the configured verbosity', () => {
    const store = ConfigHarness.store(
      { provider: 'fake', model: TestModel.Generic, verbosity: 'full' },
      '',
    );
    expect(store.get().effectiveVerbosity).toBe('full');
  });

  it('an invalid override is a usage failure, since the invocation set it, not the config file', () => {
    expect(
      ConfigHarness.errorKind(
        ConfigHarness.store({ provider: 'fake', model: TestModel.Generic }, 'loud'),
      ),
    ).toBe('usage');
  });

  it('an invalid override fails even when the configured verbosity is valid', () => {
    expect(
      ConfigHarness.errorKind(
        ConfigHarness.store(
          { provider: 'fake', model: TestModel.Generic, verbosity: 'full' },
          'loud',
        ),
      ),
    ).toBe('usage');
  });

  it('an invalid configured verbosity fails even when a valid override is set', () => {
    expect(
      ConfigHarness.errorKind(
        ConfigHarness.store(
          { provider: 'fake', model: TestModel.Generic, verbosity: 'loud' },
          'debug',
        ),
      ),
    ).toBe('config');
  });
});

describe('ConfigStore testDefaults', () => {
  it('resolves configured runs and threshold', () => {
    const testDefaults = { runs: RunCount.Gated, threshold: Threshold.Strict };
    const store = ConfigHarness.store({ provider: 'fake', model: TestModel.Generic, testDefaults });
    expect(store.get().testDefaults).toEqual(testDefaults);
  });

  it('resolves configured inference and test timeouts', () => {
    const testDefaults = {
      inferenceTimeout: CustomTimeout.Long,
      testTimeout: CustomTimeout.Longer,
    };
    const store = ConfigHarness.store({ provider: 'fake', model: TestModel.Generic, testDefaults });
    expect(store.get().testDefaults).toEqual(testDefaults);
  });

  it('accepts a single configured field, leaving the other unset', () => {
    const store = ConfigHarness.store({
      provider: 'fake',
      model: TestModel.Generic,
      testDefaults: { threshold: Threshold.Strict },
    });
    expect(store.get().testDefaults).toEqual({ threshold: Threshold.Strict });
  });

  it('resolves a configured strict extraction default', () => {
    const store = ConfigHarness.store({
      provider: 'fake',
      model: TestModel.Generic,
      testDefaults: { strict: true },
    });
    expect(store.get().testDefaults).toEqual({ strict: true });
  });

  it('resolves to no defaults when testDefaults is absent', () => {
    const store = ConfigHarness.store({ provider: 'fake', model: TestModel.Generic });
    expect(store.get().testDefaults).toEqual({});
  });

  it.each([
    ['zero threshold', { threshold: InvalidTestDefault.Zero }],
    ['threshold above one', { threshold: InvalidTestDefault.AboveOne }],
    ['negative threshold', { threshold: InvalidTestDefault.Negative }],
    ['string threshold', { threshold: String(Threshold.Strict) }],
    ['zero runs', { runs: InvalidTestDefault.Zero }],
    ['negative runs', { runs: InvalidTestDefault.Negative }],
    ['fractional runs', { runs: InvalidTestDefault.Fractional }],
    ['string runs', { runs: String(RunCount.Gated) }],
    ['unknown key', { run: RunCount.Gated }],
    ['null', null],
    ['array', [RunCount.Gated]],
    ['number', RunCount.Gated],
    ['zero inferenceTimeout', { inferenceTimeout: InvalidTimeout.Zero }],
    ['fractional inferenceTimeout', { inferenceTimeout: InvalidTimeout.Fractional }],
    [
      'inferenceTimeout above the timer maximum',
      { inferenceTimeout: InvalidTimeout.AboveTimerMax },
    ],
    ['negative testTimeout', { testTimeout: InvalidTimeout.Negative }],
    ['string testTimeout', { testTimeout: String(CustomTimeout.Long) }],
    ['testTimeout above the timer maximum', { testTimeout: InvalidTimeout.AboveTimerMax }],
    ['string strict', { strict: String(true) }],
    ['numeric strict', { strict: 1 }],
  ])('rejects %s as a config failure at load', (_label, testDefaults) => {
    expect(
      ConfigHarness.errorKind(
        ConfigHarness.store({ provider: 'fake', model: TestModel.Generic, testDefaults }),
      ),
    ).toBe('config');
  });
});

describe('ConfigStore excerptChars', () => {
  it('defaults the response excerpt to 500 characters', () => {
    const store = ConfigHarness.store({ provider: 'fake', model: TestModel.Generic });
    expect(store.get().excerptChars).toBe(ExcerptChars.Default);
  });

  it('resolves a configured excerpt length', () => {
    const store = ConfigHarness.store({
      provider: 'fake',
      model: TestModel.Generic,
      excerptChars: ExcerptChars.Short,
    });
    expect(store.get().excerptChars).toBe(ExcerptChars.Short);
  });

  it.each([
    ['zero', InvalidExcerptChars.Zero],
    ['negative', InvalidExcerptChars.Negative],
    ['fractional', InvalidExcerptChars.Fractional],
    ['string', String(ExcerptChars.Short)],
    ['null', null],
  ])('rejects a %s excerpt length as a config failure at load', (_label, excerptChars) => {
    expect(
      ConfigHarness.errorKind(
        ConfigHarness.store({ provider: 'fake', model: TestModel.Generic, excerptChars }),
      ),
    ).toBe('config');
  });
});

describe('ConfigStore built-in providers', () => {
  const reply = ChatAdapterHarness.rawJudgeReply;

  it.each([
    [ProviderName.OpenRouter, EndpointUrl.OpenRouter],
    [ProviderName.OpenAi, EndpointUrl.OpenAi],
  ])('judges through %s with the key from CRUCIBLE_JUDGE_KEY', async (provider, endpoint) => {
    const store = ConfigHarness.builtInStore(
      { provider, model: TestModel.Generic },
      FakeFetchBoundary.serving(endpoint, ApiKey.Valid, reply),
      new FakeEnvironment({ [KeyEnv.Default]: ApiKey.Valid }),
    );
    await expect(ChatAdapterHarness.complete(store.get().provider)).resolves.toBe(reply);
  });

  it.each([
    [ProviderName.OpenRouter, EndpointUrl.OpenRouter],
    [ProviderName.OpenAi, EndpointUrl.OpenAi],
  ])('judges through %s with the key from apiKeyEnv', async (provider, endpoint) => {
    const store = ConfigHarness.builtInStore(
      { provider, model: TestModel.Generic, apiKeyEnv: KeyEnv.Gateway },
      FakeFetchBoundary.serving(endpoint, ApiKey.Valid, reply),
      new FakeEnvironment({ [KeyEnv.Gateway]: ApiKey.Valid, [KeyEnv.Default]: ApiKey.Other }),
    );
    await expect(ChatAdapterHarness.complete(store.get().provider)).resolves.toBe(reply);
  });

  it.each([ProviderName.OpenRouter, ProviderName.OpenAi])(
    '%s no longer reads its provider-native key variable',
    async (provider) => {
      const store = ConfigHarness.builtInStore(
        { provider, model: TestModel.Generic },
        FakeFetchBoundary.respondingWith(200, FakeFetchBoundary.successEnvelope(reply)),
        new FakeEnvironment({
          [KeyEnv.LegacyOpenRouter]: ApiKey.Valid,
          [KeyEnv.LegacyOpenAi]: ApiKey.Valid,
        }),
      );
      expect(await ChatAdapterHarness.failureKind(store.get().provider)).toBe('config');
    },
  );

  it('judges through an openai-compatible endpoint with the key from CRUCIBLE_JUDGE_KEY', async () => {
    const store = ConfigHarness.builtInStore(
      {
        provider: ProviderName.OpenAiCompatible,
        baseUrl: BaseUrl.Gateway,
        model: TestModel.Generic,
      },
      FakeFetchBoundary.serving(EndpointUrl.Gateway, ApiKey.Valid, reply),
      new FakeEnvironment({ [KeyEnv.Default]: ApiKey.Valid }),
    );
    await expect(ChatAdapterHarness.complete(store.get().provider)).resolves.toBe(reply);
  });

  it('judges through an openai-compatible endpoint with the key from apiKeyEnv', async () => {
    const store = ConfigHarness.builtInStore(
      {
        provider: ProviderName.OpenAiCompatible,
        baseUrl: BaseUrl.Gateway,
        apiKeyEnv: KeyEnv.Gateway,
        model: TestModel.Generic,
      },
      FakeFetchBoundary.serving(EndpointUrl.Gateway, ApiKey.Valid, reply),
      new FakeEnvironment({ [KeyEnv.Gateway]: ApiKey.Valid }),
    );
    await expect(ChatAdapterHarness.complete(store.get().provider)).resolves.toBe(reply);
  });

  it('strips a trailing slash from baseUrl', async () => {
    const store = ConfigHarness.builtInStore(
      {
        provider: ProviderName.OpenAiCompatible,
        baseUrl: BaseUrl.LocalWithTrailingSlash,
        model: TestModel.Generic,
      },
      FakeFetchBoundary.servingWithoutCredentials(EndpointUrl.Local, reply),
    );
    await expect(ChatAdapterHarness.complete(store.get().provider)).resolves.toBe(reply);
  });

  it('an apiKeyEnv naming an unset variable fails as config at call time, not at load', async () => {
    const store = ConfigHarness.builtInStore({
      provider: ProviderName.OpenAiCompatible,
      baseUrl: BaseUrl.Gateway,
      apiKeyEnv: KeyEnv.Gateway,
      model: TestModel.Generic,
    });
    expect(await ChatAdapterHarness.failureKind(store.get().provider)).toBe('config');
  });
});

describe('ConfigStore rejects invalid provider settings as config failures', () => {
  it.each([...Object.values(InvalidBaseUrl), 11434])(
    'openai-compatible with baseUrl %p',
    (baseUrl) => {
      expect(
        ConfigHarness.errorKind(
          ConfigHarness.builtInStore({
            provider: ProviderName.OpenAiCompatible,
            model: TestModel.Generic,
            baseUrl,
          }),
        ),
      ).toBe('config');
    },
  );

  it.each(
    [ProviderName.OpenRouter, ProviderName.OpenAi, ProviderName.OpenAiCompatible].flatMap(
      (provider) =>
        [...Object.values(InvalidKeyEnv), 42].map((apiKeyEnv) => [provider, apiKeyEnv] as const),
    ),
  )('%s with apiKeyEnv %p', (provider, apiKeyEnv) => {
    expect(
      ConfigHarness.errorKind(
        ConfigHarness.builtInStore({
          provider,
          model: TestModel.Generic,
          baseUrl: provider === ProviderName.OpenAiCompatible ? BaseUrl.Gateway : undefined,
          apiKeyEnv,
        }),
      ),
    ).toBe('config');
  });

  it('openai-compatible without baseUrl', () => {
    expect(
      ConfigHarness.errorKind(
        ConfigHarness.builtInStore({
          provider: ProviderName.OpenAiCompatible,
          model: TestModel.Generic,
        }),
      ),
    ).toBe('config');
  });

  it.each([
    [ProviderName.OpenRouter, { baseUrl: BaseUrl.Gateway }],
    [ProviderName.OpenAi, { baseUrl: BaseUrl.Gateway }],
  ])('%s with %p', (provider, settings) => {
    expect(
      ConfigHarness.errorKind(
        ConfigHarness.builtInStore({ provider, model: TestModel.Generic, ...settings }),
      ),
    ).toBe('config');
  });

  it.each([ProviderName.OpenRouter, ProviderName.OpenAi, ProviderName.OpenAiCompatible])(
    '%s never echoes a key pasted into apiKeyEnv when a key-like field is also present',
    (provider) => {
      const store = ConfigHarness.builtInStore({
        provider,
        model: TestModel.Generic,
        baseUrl: provider === ProviderName.OpenAiCompatible ? BaseUrl.Gateway : undefined,
        apiKeyEnv: InvalidKeyEnv.KeyValue,
        token: InvalidKeyEnv.KeyValue,
      });
      expect(ConfigHarness.revealsInError(store, InvalidKeyEnv.KeyValue)).toBe(false);
    },
  );

  it.each([ProviderName.OpenRouter, ProviderName.OpenAi, ProviderName.OpenAiCompatible])(
    '%s never echoes a key pasted into apiKeyEnv',
    (provider) => {
      const store = ConfigHarness.builtInStore({
        provider,
        model: TestModel.Generic,
        baseUrl: provider === ProviderName.OpenAiCompatible ? BaseUrl.Gateway : undefined,
        apiKeyEnv: InvalidKeyEnv.KeyValue,
      });
      expect(ConfigHarness.revealsInError(store, InvalidKeyEnv.KeyValue)).toBe(false);
    },
  );
});

describe('ConfigStore and the shipped JSON Schema agree on defaults', () => {
  const reply = ChatAdapterHarness.rawJudgeReply;
  const judge = { provider: ProviderName.OpenRouter, model: TestModel.Generic };

  it('a config holding every schema default resolves like one that sets none', () => {
    const explicit = ConfigHarness.builtInStore({ ...ConfigSchemaHarness.defaults(), ...judge });
    expect(ConfigHarness.resolvedSettings(explicit)).toEqual(
      ConfigHarness.resolvedSettings(ConfigHarness.builtInStore(judge)),
    );
  });

  it('schema defaults keep the test timeout growing with runs', () => {
    const runs = { runs: RunCount.Gated };
    const explicit = ConfigHarness.builtInStore({
      ...ConfigSchemaHarness.defaultsWithTestDefaults(runs),
      ...judge,
    });
    expect(ConfigHarness.resolvedSettings(explicit)).toEqual(
      ConfigHarness.resolvedSettings(ConfigHarness.builtInStore({ ...judge, testDefaults: runs })),
    );
  });

  it('the schema default key variable is the one the judge reads', async () => {
    const store = ConfigHarness.builtInStore(
      { ...ConfigSchemaHarness.defaults(), ...judge },
      FakeFetchBoundary.serving(EndpointUrl.OpenRouter, ApiKey.Valid, reply),
      new FakeEnvironment({ [KeyEnv.Default]: ApiKey.Valid }),
    );
    await expect(ChatAdapterHarness.complete(store.get().provider)).resolves.toBe(reply);
  });
});
