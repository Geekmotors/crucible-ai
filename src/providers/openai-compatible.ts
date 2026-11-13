import { CrucibleError } from '../core/errors.js';
import { ChatCompletionsAdapter } from './chat-completions-adapter.js';
import { DEFAULT_JUDGE_KEY_ENV } from './judge-key.js';
import { OneTimeWarning } from './one-time-warning.js';
import type { EnvReader, FetchLike, WarningSink } from './provider-boundary.js';
import { TransportSecurity } from './transport-security.util.js';
import type { ProviderAdapter, ProviderFactory, ProviderSettings } from './types.js';

class OpenAiCompatibleProvider implements ProviderFactory {
  readonly name = 'openai-compatible';
  readonly settingUses = { baseUrl: 'required', apiKeyEnv: 'optional' } as const;
  private readonly plainHttpWarning: OneTimeWarning;

  constructor(
    private readonly fetchLike: FetchLike,
    private readonly readEnv: EnvReader,
    warn: WarningSink,
  ) {
    this.plainHttpWarning = new OneTimeWarning(warn);
  }

  create(settings: ProviderSettings): ProviderAdapter {
    const baseUrl = settings.baseUrl;
    if (baseUrl === undefined) {
      throw new CrucibleError(
        'config',
        `Provider "${this.name}" needs "baseUrl", e.g. "http://localhost:11434/v1".`,
      );
    }
    const keyEnvVar = settings.apiKeyEnv ?? DEFAULT_JUDGE_KEY_ENV;
    return new ChatCompletionsAdapter(
      {
        name: this.name,
        baseUrl,
        keyEnvVar,
        keyRequired: settings.apiKeyEnv !== undefined,
        keyOwner: baseUrl,
        onKeySent: TransportSecurity.exposesKey(baseUrl)
          ? () => this.warnPlainHttp(baseUrl, keyEnvVar)
          : undefined,
      },
      this.fetchLike,
      this.readEnv,
    );
  }

  private warnPlainHttp(baseUrl: string, keyEnvVar: string): void {
    this.plainHttpWarning.emit(
      `crucible: the judge key from ${keyEnvVar} is sent unencrypted over plain http to ` +
        `${baseUrl}. Use https, or a loopback address for a local server.`,
    );
  }
}

export { OpenAiCompatibleProvider };
