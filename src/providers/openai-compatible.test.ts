import { describe, expect, it } from '@jest/globals';
import { Capture } from '../core/test/capture.util.js';
import { CrucibleError } from '../core/errors.js';
import { OpenAiCompatibleProvider } from './openai-compatible.js';
import { ApiKey } from './test/api-key.enum.js';
import { BaseUrl } from './test/base-url.enum.js';
import { ChatAdapterHarness } from './test/chat-adapter-harness.util.js';
import { EndpointUrl } from './test/endpoint-url.enum.js';
import { FakeEnvironment } from './test/environment.fake.js';
import { FakeFetchBoundary } from './test/fetch-boundary.fake.js';
import { KeyEnv } from './test/key-env.enum.js';

const REPLY = ChatAdapterHarness.rawJudgeReply;

describe('OpenAiCompatibleProvider', () => {
  it('judges through <baseUrl>/chat/completions with the key from the named variable', async () => {
    const adapter = new OpenAiCompatibleProvider(
      FakeFetchBoundary.serving(EndpointUrl.Gateway, ApiKey.Valid, REPLY).fetchLike,
      new FakeEnvironment({ [KeyEnv.Gateway]: ApiKey.Valid }).read,
    ).create({ baseUrl: BaseUrl.Gateway, apiKeyEnv: KeyEnv.Gateway });
    await expect(ChatAdapterHarness.complete(adapter)).resolves.toBe(REPLY);
  });

  it('sends no credentials when no key variable is named', async () => {
    const adapter = new OpenAiCompatibleProvider(
      FakeFetchBoundary.servingWithoutCredentials(EndpointUrl.Local, REPLY).fetchLike,
      new FakeEnvironment({ [KeyEnv.OpenAi]: ApiKey.Valid }).read,
    ).create({ baseUrl: BaseUrl.Local });
    await expect(ChatAdapterHarness.complete(adapter)).resolves.toBe(REPLY);
  });

  it.each([{}, { [KeyEnv.Gateway]: '' }])(
    'fails as config when the named key variable is unset or empty (%p)',
    async (variables) => {
      const adapter = new OpenAiCompatibleProvider(
        FakeFetchBoundary.serving(EndpointUrl.Gateway, ApiKey.Valid, REPLY).fetchLike,
        new FakeEnvironment(variables).read,
      ).create({ baseUrl: BaseUrl.Gateway, apiKeyEnv: KeyEnv.Gateway });
      expect(await ChatAdapterHarness.failureKind(adapter)).toBe('config');
    },
  );

  it('cannot be created without a base URL', () => {
    const factory = new OpenAiCompatibleProvider(
      FakeFetchBoundary.servingWithoutCredentials(EndpointUrl.Local, REPLY).fetchLike,
      new FakeEnvironment().read,
    );
    const error = Capture.thrown(() => factory.create({}));
    expect(error).toBeInstanceOf(CrucibleError);
    expect((error as CrucibleError).kind).toBe('config');
  });
});
