import { ChatCompletionsAdapter } from './chat-completions-adapter.js';
import type { EnvReader, FetchLike } from './provider-boundary.js';
import type { ProviderAdapter, ProviderFactory } from './types.js';

class OpenRouterProvider implements ProviderFactory {
  readonly name = 'openrouter';
  readonly settingUses = { baseUrl: 'unsupported', apiKeyEnv: 'unsupported' } as const;

  constructor(
    private readonly fetchLike: FetchLike,
    private readonly readEnv: EnvReader,
  ) {}

  create(): ProviderAdapter {
    return new ChatCompletionsAdapter(
      {
        name: this.name,
        baseUrl: 'https://openrouter.ai/api/v1',
        keyEnvVar: 'OPENROUTER_API_KEY',
        keyOwner: 'OpenRouter',
      },
      this.fetchLike,
      this.readEnv,
    );
  }
}

export { OpenRouterProvider };
