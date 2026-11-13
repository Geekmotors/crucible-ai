import { CrucibleError } from '../core/errors.js';
import { ChatCompletionsAdapter } from './chat-completions-adapter.js';
import type { EnvReader, FetchLike } from './provider-boundary.js';
import type { ProviderAdapter, ProviderFactory, ProviderSettings } from './types.js';

class OpenAiCompatibleProvider implements ProviderFactory {
  readonly name = 'openai-compatible';
  readonly settingUses = { baseUrl: 'required', apiKeyEnv: 'optional' } as const;

  constructor(
    private readonly fetchLike: FetchLike,
    private readonly readEnv: EnvReader,
  ) {}

  create(settings: ProviderSettings): ProviderAdapter {
    if (settings.baseUrl === undefined) {
      throw new CrucibleError(
        'config',
        `Provider "${this.name}" needs "baseUrl", e.g. "http://localhost:11434/v1".`,
      );
    }
    return new ChatCompletionsAdapter(
      {
        name: this.name,
        baseUrl: settings.baseUrl,
        keyEnvVar: settings.apiKeyEnv,
        keyOwner: settings.baseUrl,
      },
      this.fetchLike,
      this.readEnv,
    );
  }
}

export { OpenAiCompatibleProvider };
