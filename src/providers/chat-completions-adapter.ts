import { CrucibleError } from '../core/errors.js';
import type { EnvReader, FetchLike, ProviderHttpResponse } from './provider-boundary.js';
import { ProviderEnvelopeError } from './provider-envelope-error.js';
import { ProviderHttpError } from './provider-http-error.js';
import type { CompletionRequest, FailureClass, ProviderAdapter } from './types.js';

type ChatEndpoint = {
  readonly name: string;
  readonly baseUrl: string;
  readonly keyEnvVar: string;
  readonly keyRequired: boolean;
  readonly keyOwner: string;
  readonly onKeySent?: () => void;
};

class ChatCompletionsAdapter implements ProviderAdapter {
  private static readonly COMPLETIONS_PATH = '/chat/completions';
  private static readonly RETRYABLE_CLIENT_STATUSES: ReadonlySet<number> = new Set([408, 429]);
  private static readonly KEY_CHARACTERS = /^[\x21-\x7e]+$/;

  readonly name: string;
  readonly envVar: string;
  private readonly url: string;

  constructor(
    private readonly endpoint: ChatEndpoint,
    private readonly fetchLike: FetchLike,
    private readonly readEnv: EnvReader,
  ) {
    this.name = endpoint.name;
    this.envVar = endpoint.keyEnvVar;
    this.url = `${endpoint.baseUrl}${ChatCompletionsAdapter.COMPLETIONS_PATH}`;
  }

  async complete(request: CompletionRequest, signal: AbortSignal): Promise<string> {
    const body = this.serializeRequestBody(request);
    const headers = { ...this.authorization(), 'Content-Type': 'application/json' };
    const response = await this.fetchLike(this.url, { method: 'POST', headers, body, signal });
    if (!response.ok) {
      throw new ProviderHttpError(this.name, response.status);
    }
    const envelope = await this.parseEnvelope(response);
    this.rejectEmbeddedError(envelope);
    return this.unwrapCompletionText(envelope);
  }

  classifyFailure(error: unknown): FailureClass {
    if (error instanceof ProviderHttpError) {
      return this.isFatalStatus(error.status) ? 'fatal' : 'retryable';
    }
    if (error instanceof CrucibleError) {
      return error.kind === 'infra' && error.retryable === true ? 'retryable' : 'fatal';
    }
    return 'retryable';
  }

  private authorization(): Record<string, string> {
    const key = this.readEnv(this.endpoint.keyEnvVar)?.trim();
    if (key === undefined || key === '') {
      this.rejectMissingKey();
      return {};
    }
    this.rejectMalformedKey(key);
    this.endpoint.onKeySent?.();
    return { Authorization: `Bearer ${key}` };
  }

  private rejectMissingKey(): void {
    if (this.endpoint.keyRequired) {
      throw new CrucibleError(
        'config',
        `Set the ${this.endpoint.keyEnvVar} environment variable to the API key for ` +
          `${this.endpoint.keyOwner}.`,
      );
    }
  }

  private rejectMalformedKey(key: string): void {
    if (!ChatCompletionsAdapter.KEY_CHARACTERS.test(key)) {
      throw new CrucibleError(
        'config',
        `The ${this.endpoint.keyEnvVar} environment variable holds characters that cannot ` +
          `appear in an API key.`,
      );
    }
  }

  private serializeRequestBody(request: CompletionRequest): string {
    const messages =
      request.system !== undefined
        ? [
            { role: 'system', content: request.system },
            { role: 'user', content: request.prompt },
          ]
        : [{ role: 'user', content: request.prompt }];
    try {
      return JSON.stringify({ ...request.meta, model: request.model, messages });
    } catch (cause) {
      throw new CrucibleError('usage', 'Config meta is not JSON-serializable.', { cause });
    }
  }

  private isFatalStatus(status: number): boolean {
    return (
      status >= 400 && status < 500 && !ChatCompletionsAdapter.RETRYABLE_CLIENT_STATUSES.has(status)
    );
  }

  private rejectEmbeddedError(envelope: unknown): void {
    const embedded = (envelope as { error?: unknown })?.error;
    if (embedded === undefined || embedded === null) {
      return;
    }
    const code = (embedded as { code?: unknown }).code;
    if (typeof code === 'number') {
      throw new ProviderHttpError(this.name, code);
    }
    throw new ProviderEnvelopeError(this.name);
  }

  private async parseEnvelope(response: ProviderHttpResponse): Promise<unknown> {
    try {
      return await response.json();
    } catch {
      throw new ProviderEnvelopeError(this.name);
    }
  }

  private unwrapCompletionText(envelope: unknown): string {
    const choices = (envelope as { choices?: unknown })?.choices;
    const first = Array.isArray(choices) ? (choices[0] as unknown) : undefined;
    const content = (first as { message?: { content?: unknown } })?.message?.content;
    if (typeof content !== 'string') {
      throw new ProviderEnvelopeError(this.name);
    }
    return content;
  }
}

export { ChatCompletionsAdapter };
export type { ChatEndpoint };
