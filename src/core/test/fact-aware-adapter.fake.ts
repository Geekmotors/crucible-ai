import type { CompletionRequest, FailureClass, ProviderAdapter } from '../../providers/types.js';

class FactAwareAdapter implements ProviderAdapter {
  name = 'fact-aware';
  envVar = 'FACT_AWARE_API_KEY';

  constructor(private fact: string) {}

  complete(request: CompletionRequest): Promise<string> {
    const verdict = request.prompt.includes(this.fact);
    return Promise.resolve(JSON.stringify({ verdict, reasoning: 'judged against state' }));
  }

  classifyFailure(): FailureClass {
    return 'fatal';
  }
}

export { FactAwareAdapter };
