import { ChatCompletionsAdapter } from '../chat-completions-adapter.js';
import type { ChatEndpoint } from '../chat-completions-adapter.js';
import type { ProviderAdapter } from '../types.js';
import { ApiKey } from './api-key.enum.js';
import { BaseUrl } from './base-url.enum.js';
import { FakeEnvironment } from './environment.fake.js';
import { FakeFetchBoundary } from './fetch-boundary.fake.js';
import { KeyEnv } from './key-env.enum.js';
import { TestModel } from './test-model.enum.js';

class ChatAdapterHarness {
  static judgePrompt = 'judge this';
  static rawJudgeReply = '  {"verdict": true, "reasoning": "state and response agree"}\n';

  static keyedEndpoint: ChatEndpoint = {
    name: 'test-endpoint',
    baseUrl: BaseUrl.Gateway,
    keyEnvVar: KeyEnv.Gateway,
    keyRequired: true,
    keyOwner: 'test endpoint',
  };

  static keyedEnvironment(): FakeEnvironment {
    return new FakeEnvironment({ [KeyEnv.Gateway]: ApiKey.Valid });
  }

  static adapter(
    boundary: FakeFetchBoundary,
    environment: FakeEnvironment = ChatAdapterHarness.keyedEnvironment(),
    endpoint: ChatEndpoint = ChatAdapterHarness.keyedEndpoint,
  ): ChatCompletionsAdapter {
    return new ChatCompletionsAdapter(endpoint, boundary.fetchLike, environment.read);
  }

  static complete(adapter: ProviderAdapter): Promise<string> {
    return adapter.complete(
      { model: TestModel.Generic, prompt: ChatAdapterHarness.judgePrompt },
      new AbortController().signal,
    );
  }
}

export { ChatAdapterHarness };
