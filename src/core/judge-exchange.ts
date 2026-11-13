import type { CompletionRequest, ProviderAdapter } from '../providers/types.js';
import { CrucibleError } from './errors.js';
import { RetryingCompleter } from './retry.js';
import { RunScope, runScope } from './state.js';
import { TraceReporter } from './trace-reporter.js';

type CompletionTarget = {
  readonly adapter: ProviderAdapter;
  readonly model: string;
  readonly meta?: Readonly<Record<string, unknown>>;
};

type CompletionTargetSupplier = () => CompletionTarget;
type SchemaTextSupplier = () => string;
type Deadline = (ms: number) => AbortSignal;
type ReplyReader<T> = (reply: unknown) => T | undefined;

type JudgeQuestion<T> = {
  readonly system: string;
  readonly prompt: string;
  readonly contract: string;
  readonly read: ReplyReader<T>;
};

class JudgeExchange {
  private static readonly MAX_REPLY_ATTEMPTS = 2;

  private static timeoutDeadline(ms: number): AbortSignal {
    return AbortSignal.timeout(ms);
  }

  constructor(
    private readonly completer: RetryingCompleter,
    private readonly target: CompletionTargetSupplier,
    private readonly scope: RunScope = runScope,
    private readonly trace: TraceReporter = new TraceReporter(),
    private readonly deadline: Deadline = JudgeExchange.timeoutDeadline,
  ) {}

  async ask<T>(question: JudgeQuestion<T>): Promise<T> {
    const { adapter, model, meta } = this.target();
    const request: CompletionRequest = {
      model,
      system: question.system,
      prompt: question.prompt,
      meta,
    };
    let attempts = 0;
    const counted: ProviderAdapter = {
      name: adapter.name,
      envVar: adapter.envVar,
      complete: (req, signal) => {
        attempts += 1;
        return adapter.complete(req, signal);
      },
      classifyFailure: (error) => adapter.classifyFailure(error),
    };
    const runSignal = this.scope.abortSignal();
    try {
      return await this.answered(counted, request, runSignal, question);
    } catch (cause) {
      this.trace.judgeRecorded(this.scope.recordError({ cause, attempts }));
      throw cause;
    }
  }

  private async answered<T>(
    adapter: ProviderAdapter,
    request: CompletionRequest,
    runSignal: AbortSignal,
    question: JudgeQuestion<T>,
  ): Promise<T> {
    let lastFailure: CrucibleError | undefined;
    for (let attempt = 1; attempt <= JudgeExchange.MAX_REPLY_ATTEMPTS; attempt += 1) {
      const reply = await this.completeBeforeDeadline(adapter, request, runSignal);
      try {
        return this.parsed(reply, question);
      } catch (failure) {
        this.trace.judgeReplyRejected(attempt, failure);
        lastFailure = failure as CrucibleError;
      }
    }
    throw lastFailure;
  }

  private async completeBeforeDeadline(
    adapter: ProviderAdapter,
    request: CompletionRequest,
    runSignal: AbortSignal,
  ): Promise<string> {
    const timeoutMs = this.scope.inferenceTimeout();
    const deadline = this.deadline(timeoutMs);
    try {
      return await this.completer.complete(
        adapter,
        request,
        AbortSignal.any([runSignal, deadline]),
      );
    } catch (failure) {
      if (deadline.aborted && !runSignal.aborted) {
        throw new CrucibleError('infra', `The judge call did not finish within ${timeoutMs} ms.`, {
          retryable: true,
          cause: failure,
        });
      }
      throw failure;
    }
  }

  private parsed<T>(reply: string, question: JudgeQuestion<T>): T {
    let json: unknown;
    try {
      json = JSON.parse(this.stripFences(reply));
    } catch (cause) {
      throw this.unexpected(question.contract, cause);
    }
    const read = question.read(json);
    if (read === undefined) {
      throw this.unexpected(question.contract);
    }
    return read;
  }

  private stripFences(reply: string): string {
    return reply
      .trim()
      .replace(/^```[a-z]*\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();
  }

  private unexpected(contract: string, cause?: unknown): CrucibleError {
    return new CrucibleError('infra', `The judge reply was not the expected ${contract} JSON.`, {
      retryable: true,
      cause,
    });
  }
}

export { JudgeExchange };
export type {
  CompletionTarget,
  CompletionTargetSupplier,
  Deadline,
  JudgeQuestion,
  ReplyReader,
  SchemaTextSupplier,
};
