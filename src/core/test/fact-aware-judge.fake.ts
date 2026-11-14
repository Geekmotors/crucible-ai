import type { CompletionRequest, FailureClass, ProviderAdapter } from '../../providers/types.js';

class FactAwareJudge implements ProviderAdapter {
  name = 'fact-aware';
  envVar = 'FACT_AWARE_API_KEY';

  constructor(
    private facts: readonly string[],
    private seenReply: string,
    private unseenReply: string,
  ) {}

  complete(request: CompletionRequest): Promise<string> {
    const stateSection = `STATE\n<<<\n${this.facts.join('\n')}\n>>>\n\nRESPONSE\n`;
    return Promise.resolve(
      request.prompt.startsWith(stateSection) ? this.seenReply : this.unseenReply,
    );
  }

  classifyFailure(): FailureClass {
    return 'retryable';
  }
}

export { FactAwareJudge };
