import { ChatCompletionsAdapter } from './chat-completions-adapter.js';
import type { EnvReader, FetchLike } from './provider-boundary.js';
import type { ProviderAdapter, ProviderFactory } from './types.js';

class OpenAiProvider implements ProviderFactory {
  readonly name = 'openai';
  readonly settingUses = { baseUrl: 'unsupported', apiKeyEnv: 'unsupported' } as const;

  constructor(
    private readonly fetchLike: FetchLike,
    private readonly readEnv: EnvReader,
  ) {}

  create(): ProviderAdapter {
    return new ChatCompletionsAdapter(
      {
        name: this.name,
        baseUrl: 'https://api.openai.com/v1',
        keyEnvVar: 'OPENAI_API_KEY',
        keyOwner: 'OpenAI',
      },
      this.fetchLike,
      this.readEnv,
    );
  }
}

export { OpenAiProvider };
