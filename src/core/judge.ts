import type { ProviderAdapter } from '../providers/types.js';
import { CrucibleError } from './errors.js';
import { PayloadAssembler } from './payload-assembler.util.js';
import { RetryingCompleter } from './retry.js';
import { RunScope, runScope } from './state.js';
import { TraceReporter } from './trace-reporter.js';

const COHERENT_ASSERTION = 'coherent';
const MAX_REPLY_ATTEMPTS = 2;

type CompletionTarget = {
  readonly adapter: ProviderAdapter;
  readonly model: string;
  readonly meta?: Readonly<Record<string, unknown>>;
};

type SchemaTextSupplier = () => string;
type CompletionTargetSupplier = () => CompletionTarget;
type Deadline = (ms: number) => AbortSignal;

type ParsedVerdict = {
  readonly verdict: boolean;
  readonly reasoning: string;
};

class Judge {
  private readonly assembler = new PayloadAssembler();

  private static timeoutDeadline(ms: number): AbortSignal {
    return AbortSignal.timeout(ms);
  }

  constructor(
    private readonly schemaText: SchemaTextSupplier,
    private readonly completer: RetryingCompleter,
    private readonly target: CompletionTargetSupplier,
    private readonly scope: RunScope = runScope,
    private readonly trace: TraceReporter = new TraceReporter(),
    private readonly deadline: Deadline = Judge.timeoutDeadline,
  ) {}

  async judgeCoherent(response: string, claim: string): Promise<boolean> {
    this.requireStrings(response, claim);
    const state = this.scope.context().state;
    const { adapter, model, meta } = this.target();
    const request = {
      model,
      system: this.schemaText(),
      prompt: this.assembler.assemble(state, response, claim),
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
      const parsed = await this.judgedReply(counted, request, runSignal);
      const record = this.scope.recordVerdict({
        assertion: COHERENT_ASSERTION,
        claim,
        verdict: parsed.verdict,
        reasoning: parsed.reasoning,
        response,
      });
      this.trace.judgeRecorded(record);
      return parsed.verdict;
    } catch (cause) {
      this.trace.judgeRecorded(this.scope.recordError({ cause, attempts }));
      throw cause;
    }
  }

  private async judgedReply(
    adapter: ProviderAdapter,
    request: Parameters<RetryingCompleter['complete']>[1],
    runSignal: AbortSignal,
  ): Promise<ParsedVerdict> {
    let lastFailure: CrucibleError | undefined;
    for (let attempt = 1; attempt <= MAX_REPLY_ATTEMPTS; attempt += 1) {
      const reply = await this.completeBeforeDeadline(adapter, request, runSignal);
      try {
        return this.parseReply(reply);
      } catch (failure) {
        this.trace.judgeReplyRejected(attempt, failure);
        lastFailure = failure as CrucibleError;
      }
    }
    throw lastFailure;
  }

  private async completeBeforeDeadline(
    adapter: ProviderAdapter,
    request: Parameters<RetryingCompleter['complete']>[1],
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

  private requireStrings(response: unknown, claim: unknown): void {
    if (typeof response !== 'string' || typeof claim !== 'string') {
      throw new CrucibleError(
        'usage',
        'crucible.coherent needs a string response and a string claim.',
      );
    }
  }

  private parseReply(reply: string): ParsedVerdict {
    let parsed: unknown;
    try {
      parsed = JSON.parse(this.stripFences(reply));
    } catch (cause) {
      throw this.notAVerdict(cause);
    }
    const verdict = (parsed as { verdict?: unknown } | null)?.verdict;
    const reasoning = (parsed as { reasoning?: unknown } | null)?.reasoning;
    if (typeof verdict === 'boolean' && typeof reasoning === 'string') {
      return { verdict, reasoning };
    }
    throw this.notAVerdict();
  }

  private stripFences(reply: string): string {
    return reply
      .trim()
      .replace(/^```[a-z]*\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();
  }

  private notAVerdict(cause?: unknown): CrucibleError {
    return new CrucibleError(
      'infra',
      'The judge reply was not the expected { "verdict": boolean, "reasoning": string } JSON.',
      { retryable: true, cause },
    );
  }
}

export { Judge };
export type { CompletionTarget, CompletionTargetSupplier, Deadline, SchemaTextSupplier };
