import type { CompletionRequest, ProviderAdapter } from '../providers/types.js';
import { CrucibleError } from './errors.js';
import { TraceReporter } from './trace-reporter.js';

const MAX_ATTEMPTS = 3;

type Sleep = (ms: number) => Promise<void>;

type BackoffPolicy = {
  readonly baseDelayMs?: number;
  readonly jitter?: () => number;
};

class RetryingCompleter {
  private readonly baseDelayMs: number;
  private readonly jitter: () => number;

  private static defaultSleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  constructor(
    private readonly sleep: Sleep = RetryingCompleter.defaultSleep,
    backoff: BackoffPolicy = {},
    private readonly trace: TraceReporter = new TraceReporter(),
  ) {
    this.baseDelayMs = Math.max(1, backoff.baseDelayMs ?? 250);
    this.jitter = backoff.jitter ?? Math.random;
  }

  async complete(
    adapter: ProviderAdapter,
    request: CompletionRequest,
    signal: AbortSignal,
  ): Promise<string> {
    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      this.throwIfAborted(signal);
      try {
        this.trace.providerRequest(adapter.name, request, attempt);
        const reply = await adapter.complete(request, signal);
        this.trace.providerResponse(attempt, reply);
        return reply;
      } catch (error) {
        if (signal.aborted) {
          this.trace.providerFailure(attempt, error, { next: 'aborted' });
          throw error;
        }
        lastError = this.rethrowUnlessRetryable(adapter, error, attempt);
        if (attempt < MAX_ATTEMPTS) {
          const delayMs = this.delayForRetry(attempt);
          this.trace.providerFailure(attempt, error, { next: 'retry', delayMs });
          await this.sleep(delayMs);
        } else {
          this.trace.providerFailure(attempt, error, { next: 'exhausted' });
        }
      }
    }
    throw new CrucibleError(
      'infra',
      `Provider "${adapter.name}" kept failing after ${MAX_ATTEMPTS} attempts.`,
      { retryable: true, cause: lastError },
    );
  }

  private throwIfAborted(signal: AbortSignal): void {
    if (signal.aborted) {
      throw signal.reason instanceof Error ? signal.reason : new Error('aborted');
    }
  }

  private rethrowUnlessRetryable(
    adapter: ProviderAdapter,
    error: unknown,
    attempt: number,
  ): unknown {
    if (error instanceof CrucibleError) {
      if (error.kind === 'infra' && error.retryable === true) {
        return error;
      }
      this.trace.providerFailure(attempt, error, { next: 'fatal' });
      throw error;
    }
    if (adapter.classifyFailure(error) === 'fatal') {
      this.trace.providerFailure(attempt, error, { next: 'fatal' });
      throw new CrucibleError('infra', `Provider "${adapter.name}" failed fatally.`, {
        retryable: false,
        cause: error,
      });
    }
    return error;
  }

  private delayForRetry(retryNumber: number): number {
    return Math.max(0, this.baseDelayMs * 2 ** (retryNumber - 1) * (1 + this.jitter()));
  }
}

export { RetryingCompleter };
export type { BackoffPolicy, Sleep };
