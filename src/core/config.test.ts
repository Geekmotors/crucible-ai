import { describe, expect, it } from '@jest/globals';
import { ConfigStore } from './config.js';
import { ConfigHarness } from './test/config-harness.util.js';
import { FakeConfigBoundary } from './test/config-boundary.fake.js';
import { providerRegistry } from '../providers/registry.js';
import { ROUTING_META } from '../providers/test/routing-meta.fake.js';
import { TestModel } from '../providers/test/test-model.enum.js';
import { ExcerptChars } from './test/excerpt-chars.enum.js';
import { InvalidExcerptChars } from './test/invalid-excerpt-chars.enum.js';
import { InvalidTestDefault } from './test/invalid-test-default.enum.js';
import { RunCount } from './test/run-count.enum.js';
import { Threshold } from './test/threshold.enum.js';

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

  it('resolves the built-in openrouter provider singleton through the default registry', () => {
    const store = new ConfigStore(
      new FakeConfigBoundary({
        found: true,
        raw: JSON.stringify({ provider: 'openrouter', model: TestModel.Gpt5 }),
      }),
      providerRegistry,
    );
    expect(store.get().provider).toBe(providerRegistry.resolve('openrouter'));
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
    const store = new ConfigStore(
      new FakeConfigBoundary({ found: false, reason: 'missing' }),
      ConfigHarness.registryWithFake(),
    );
    expect(ConfigHarness.errorKind(store)).toBe('config');
  });

  it('an unreadable config file is a config failure', () => {
    const store = new ConfigStore(
      new FakeConfigBoundary({ found: false, reason: 'unreadable', detail: 'EACCES' }),
      ConfigHarness.registryWithFake(),
    );
    expect(ConfigHarness.errorKind(store)).toBe('config');
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

  it('an invalid override is a config failure', () => {
    expect(
      ConfigHarness.errorKind(
        ConfigHarness.store({ provider: 'fake', model: TestModel.Generic }, 'loud'),
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

  it('accepts a single configured field, leaving the other unset', () => {
    const store = ConfigHarness.store({
      provider: 'fake',
      model: TestModel.Generic,
      testDefaults: { threshold: Threshold.Strict },
    });
    expect(store.get().testDefaults).toEqual({ threshold: Threshold.Strict });
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
