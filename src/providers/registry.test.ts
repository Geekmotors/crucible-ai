import { describe, expect, it } from '@jest/globals';
import { FakeAdapter } from './test/adapter.fake.js';
import { ApiKey } from './test/api-key.enum.js';
import { BaseUrl } from './test/base-url.enum.js';
import { ChatAdapterHarness } from './test/chat-adapter-harness.util.js';
import { EndpointUrl } from './test/endpoint-url.enum.js';
import { FakeEnvironment } from './test/environment.fake.js';
import { FakeFetchBoundary } from './test/fetch-boundary.fake.js';
import { KeyEnv } from './test/key-env.enum.js';
import { FakeProviderFactory } from './test/provider-factory.fake.js';
import { RegistryHarness } from './test/registry-harness.util.js';
import { TestModel } from './test/test-model.enum.js';
import { ProviderRegistry } from './registry.js';
import { ProviderName } from './test/provider-name.enum.js';

const REPLY = ChatAdapterHarness.rawJudgeReply;

describe('ProviderRegistry', () => {
  it('creates the adapter of the named provider', () => {
    const registry = new ProviderRegistry();
    const adapter = new FakeAdapter();
    registry.register(new FakeProviderFactory('fake', undefined, adapter));
    expect(registry.create('fake', {})).toBe(adapter);
  });

  it('creating an unregistered provider is a config failure', () => {
    const registry = new ProviderRegistry();
    registry.register(new FakeProviderFactory());
    expect(RegistryHarness.errorKind(() => registry.create('nope', {}))).toBe('config');
  });

  it('registering the same provider twice is a usage failure', () => {
    const registry = new ProviderRegistry();
    registry.register(new FakeProviderFactory());
    expect(RegistryHarness.errorKind(() => registry.register(new FakeProviderFactory()))).toBe(
      'usage',
    );
  });

  it.each([
    ['baseUrl', { baseUrl: BaseUrl.Gateway }],
    ['apiKeyEnv', { apiKeyEnv: KeyEnv.Gateway }],
  ])('a %s the provider does not take is a config failure', (_label, settings) => {
    const registry = new ProviderRegistry();
    registry.register(new FakeProviderFactory());
    expect(RegistryHarness.errorKind(() => registry.create('fake', settings))).toBe('config');
  });

  it('a missing required setting is a config failure', () => {
    const registry = new ProviderRegistry();
    registry.register(
      new FakeProviderFactory('fake', { baseUrl: 'required', apiKeyEnv: 'optional' }),
    );
    expect(RegistryHarness.errorKind(() => registry.create('fake', {}))).toBe('config');
  });

  it('accepts required and optional settings the provider takes', () => {
    const registry = new ProviderRegistry();
    const adapter = new FakeAdapter();
    registry.register(
      new FakeProviderFactory('fake', { baseUrl: 'required', apiKeyEnv: 'optional' }, adapter),
    );
    expect(registry.create('fake', { baseUrl: BaseUrl.Gateway })).toBe(adapter);
    expect(registry.create('fake', { baseUrl: BaseUrl.Gateway, apiKeyEnv: KeyEnv.Gateway })).toBe(
      adapter,
    );
  });

  it('tryCreate yields nothing instead of failing', () => {
    const registry = new ProviderRegistry();
    registry.register(new FakeProviderFactory());
    expect(registry.tryCreate('nope', {})).toBeUndefined();
    expect(registry.tryCreate('fake', { baseUrl: BaseUrl.Gateway })).toBeUndefined();
  });
});

describe('built-in provider registry', () => {
  it('judges through openrouter', async () => {
    const registry = RegistryHarness.builtIn(
      FakeFetchBoundary.serving(EndpointUrl.OpenRouter, ApiKey.Valid, REPLY),
      new FakeEnvironment({ [KeyEnv.Default]: ApiKey.Valid }),
    );
    await expect(
      ChatAdapterHarness.complete(registry.create(ProviderName.OpenRouter, {})),
    ).resolves.toBe(REPLY);
  });

  it('judges through openai', async () => {
    const registry = RegistryHarness.builtIn(
      FakeFetchBoundary.serving(EndpointUrl.OpenAi, ApiKey.Valid, REPLY),
      new FakeEnvironment({ [KeyEnv.Default]: ApiKey.Valid }),
    );
    await expect(
      ChatAdapterHarness.complete(registry.create(ProviderName.OpenAi, {})),
    ).resolves.toBe(REPLY);
  });

  it.each([
    [ProviderName.OpenRouter, EndpointUrl.OpenRouter],
    [ProviderName.OpenAi, EndpointUrl.OpenAi],
  ])('judges through %s with the key from the variable apiKeyEnv names', async (name, url) => {
    const registry = RegistryHarness.builtIn(
      FakeFetchBoundary.serving(url, ApiKey.Valid, REPLY),
      new FakeEnvironment({ [KeyEnv.Gateway]: ApiKey.Valid, [KeyEnv.Default]: ApiKey.Other }),
    );
    await expect(
      ChatAdapterHarness.complete(registry.create(name, { apiKeyEnv: KeyEnv.Gateway })),
    ).resolves.toBe(REPLY);
  });

  it('judges through openai-compatible', async () => {
    const registry = RegistryHarness.builtIn(
      FakeFetchBoundary.servingWithoutCredentials(EndpointUrl.Local, REPLY),
      new FakeEnvironment(),
    );
    const adapter = registry.create(ProviderName.OpenAiCompatible, { baseUrl: BaseUrl.Local });
    await expect(ChatAdapterHarness.complete(adapter)).resolves.toBe(REPLY);
  });

  it.each([
    [ProviderName.OpenRouter, { baseUrl: BaseUrl.Gateway }],
    [ProviderName.OpenAi, { baseUrl: BaseUrl.Gateway }],
    [ProviderName.OpenAiCompatible, {}],
    [ProviderName.OpenAiCompatible, { apiKeyEnv: KeyEnv.Gateway }],
  ])('rejects %s with settings %p as a config failure', (name, settings) => {
    const registry = RegistryHarness.builtIn(
      FakeFetchBoundary.respondingWith(200, {}),
      new FakeEnvironment(),
    );
    expect(RegistryHarness.errorKind(() => registry.create(name, settings))).toBe('config');
  });
});

describe('FakeAdapter port contract', () => {
  it('completes a request with a deterministic response', async () => {
    const response = await new FakeAdapter().complete(
      { model: TestModel.Generic, prompt: 'hello' },
      new AbortController().signal,
    );
    expect(response).toBe(`fake:${TestModel.Generic}:hello`);
  });

  it('rejects when the signal is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      new FakeAdapter().complete({ model: TestModel.Generic, prompt: 'p' }, controller.signal),
    ).rejects.toBeInstanceOf(Error);
  });

  it('classifies retry-worthy failures as retryable and the rest as fatal', () => {
    const adapter = new FakeAdapter();
    expect(adapter.classifyFailure(new Error('please retry later'))).toBe('retryable');
    expect(adapter.classifyFailure(new Error('unauthorized'))).toBe('fatal');
  });
});
