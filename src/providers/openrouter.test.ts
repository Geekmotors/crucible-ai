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
  it('judges through OpenRouter with the key from OPENROUTER_API_KEY', async () => {
    const adapter = new OpenRouterProvider(
      FakeFetchBoundary.serving(EndpointUrl.OpenRouter, ApiKey.Valid, REPLY).fetchLike,
      new FakeEnvironment({ [KeyEnv.OpenRouter]: ApiKey.Valid }).read,
    ).create();
    await expect(ChatAdapterHarness.complete(adapter)).resolves.toBe(REPLY);
  });

  it('fails as config when OPENROUTER_API_KEY is not set', async () => {
    const adapter = new OpenRouterProvider(
      FakeFetchBoundary.serving(EndpointUrl.OpenRouter, ApiKey.Valid, REPLY).fetchLike,
      new FakeEnvironment({ [KeyEnv.OpenAi]: ApiKey.Valid }).read,
    ).create();
    expect(await ChatAdapterHarness.failureKind(adapter)).toBe('config');
  });
});
