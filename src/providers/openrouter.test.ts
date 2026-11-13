import { describe, expect, it } from '@jest/globals';
import { OpenRouterProvider } from './openrouter.js';
import { ApiKey } from './test/api-key.enum.js';
import { ChatAdapterHarness } from './test/chat-adapter-harness.util.js';
import { EndpointUrl } from './test/endpoint-url.enum.js';
import { FakeEnvironment } from './test/environment.fake.js';
import { FakeFetchBoundary } from './test/fetch-boundary.fake.js';
import { KeyEnv } from './test/key-env.enum.js';

const REPLY = ChatAdapterHarness.rawJudgeReply;

describe('OpenRouterProvider', () => {
  it('judges through OpenRouter with the key from CRUCIBLE_JUDGE_KEY by default', async () => {
    const adapter = new OpenRouterProvider(
      FakeFetchBoundary.serving(EndpointUrl.OpenRouter, ApiKey.Valid, REPLY).fetchLike,
      new FakeEnvironment({ [KeyEnv.Default]: ApiKey.Valid }).read,
    ).create({});
    await expect(ChatAdapterHarness.complete(adapter)).resolves.toBe(REPLY);
  });

  it('reads the key from the variable apiKeyEnv names instead of the default', async () => {
    const adapter = new OpenRouterProvider(
      FakeFetchBoundary.serving(EndpointUrl.OpenRouter, ApiKey.Valid, REPLY).fetchLike,
      new FakeEnvironment({ [KeyEnv.Gateway]: ApiKey.Valid, [KeyEnv.Default]: ApiKey.Other }).read,
    ).create({ apiKeyEnv: KeyEnv.Gateway });
    await expect(ChatAdapterHarness.complete(adapter)).resolves.toBe(REPLY);
  });

  it.each([{}, { [KeyEnv.Default]: ApiKey.Blank }, { [KeyEnv.LegacyOpenRouter]: ApiKey.Valid }])(
    'fails as config when CRUCIBLE_JUDGE_KEY is missing or blank (%p)',
    async (variables) => {
      const adapter = new OpenRouterProvider(
        FakeFetchBoundary.serving(EndpointUrl.OpenRouter, ApiKey.Valid, REPLY).fetchLike,
        new FakeEnvironment(variables).read,
      ).create({});
      expect(await ChatAdapterHarness.failureKind(adapter)).toBe('config');
    },
  );

  it('fails as config when the variable apiKeyEnv names is unset', async () => {
    const adapter = new OpenRouterProvider(
      FakeFetchBoundary.serving(EndpointUrl.OpenRouter, ApiKey.Valid, REPLY).fetchLike,
      new FakeEnvironment({ [KeyEnv.Default]: ApiKey.Valid }).read,
    ).create({ apiKeyEnv: KeyEnv.Gateway });
    expect(await ChatAdapterHarness.failureKind(adapter)).toBe('config');
  });
});
