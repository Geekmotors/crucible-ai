import { ChatCompletionsAdapter } from './chat-completions-adapter.js';
import { DEFAULT_JUDGE_KEY_ENV } from './judge-key.js';
import type { EnvReader, FetchLike } from './provider-boundary.js';
import type { ProviderAdapter, ProviderFactory, ProviderSettings } from './types.js';

class OpenAiProvider implements ProviderFactory {
  readonly name = 'openai';
  readonly settingUses = { baseUrl: 'unsupported', apiKeyEnv: 'optional' } as const;

  constructor(
    private readonly fetchLike: FetchLike,
    private readonly readEnv: EnvReader,
  ) {}

  create(settings: ProviderSettings): ProviderAdapter {
    return new ChatCompletionsAdapter(
      {
        name: this.name,
        baseUrl: 'https://api.openai.com/v1',
        keyEnvVar: settings.apiKeyEnv ?? DEFAULT_JUDGE_KEY_ENV,
        keyRequired: true,
        keyOwner: 'OpenAI',
      },
      this.fetchLike,
      this.readEnv,
    );
  }
}

export { OpenAiProvider };
