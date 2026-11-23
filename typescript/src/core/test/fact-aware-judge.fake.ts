import type {
  Completion,
  CompletionRequest,
  FailureClass,
  ProviderAdapter,
} from '../../providers/types.js';

class FactAwareJudge implements ProviderAdapter {
  name = 'fact-aware';
  envVar = 'FACT_AWARE_API_KEY';

  constructor(
    private facts: readonly string[],
    private seenReply: string,
    private unseenReply: string,
  ) {}

  complete(request: CompletionRequest): Promise<Completion> {
    const stateSection = `STATE\n<<<\n${this.facts.join('\n')}\n>>>\n\nRESPONSE\n`;
    const reply = request.prompt.startsWith(stateSection) ? this.seenReply : this.unseenReply;
    return Promise.resolve({ reply, usage: {} });
  }

  classifyFailure(): FailureClass {
    return 'retryable';
  }
}

export { FactAwareJudge };
