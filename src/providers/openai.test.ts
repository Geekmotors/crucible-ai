import { describe, expect, it } from '@jest/globals';
import { OpenAiProvider } from './openai.js';
import { ApiKey } from './test/api-key.enum.js';
import { ChatAdapterHarness } from './test/chat-adapter-harness.util.js';
import { EndpointUrl } from './test/endpoint-url.enum.js';
import { FakeEnvironment } from './test/environment.fake.js';
import { FakeFetchBoundary } from './test/fetch-boundary.fake.js';
import { KeyEnv } from './test/key-env.enum.js';

const REPLY = ChatAdapterHarness.rawJudgeReply;

describe('OpenAiProvider', () => {
  it("judges through OpenAI's chat completions API with the key from OPENAI_API_KEY", async () => {
    const adapter = new OpenAiProvider(
      FakeFetchBoundary.serving(EndpointUrl.OpenAi, ApiKey.Valid, REPLY).fetchLike,
      new FakeEnvironment({ [KeyEnv.OpenAi]: ApiKey.Valid }).read,
    ).create();
    await expect(ChatAdapterHarness.complete(adapter)).resolves.toBe(REPLY);
  });

  it.each([{}, { [KeyEnv.OpenAi]: '' }, { [KeyEnv.OpenRouter]: ApiKey.Valid }])(
    'fails as config when OPENAI_API_KEY is missing or empty (%p)',
    async (variables) => {
      const adapter = new OpenAiProvider(
        FakeFetchBoundary.serving(EndpointUrl.OpenAi, ApiKey.Valid, REPLY).fetchLike,
        new FakeEnvironment(variables).read,
      ).create();
      expect(await ChatAdapterHarness.failureKind(adapter)).toBe('config');
    },
  );
});
