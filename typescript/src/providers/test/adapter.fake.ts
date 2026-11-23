import type { Completion, CompletionRequest, FailureClass, ProviderAdapter } from '../types.js';

class FakeAdapter implements ProviderAdapter {
  envVar = 'FAKE_API_KEY';

  constructor(public name: string = 'fake') {}

  complete(request: CompletionRequest, signal: AbortSignal): Promise<Completion> {
    if (signal.aborted) {
      return Promise.reject(signal.reason instanceof Error ? signal.reason : new Error('aborted'));
    }
    return Promise.resolve({ reply: `fake:${request.model}:${request.prompt}`, usage: {} });
  }

  classifyFailure(error: unknown): FailureClass {
    return error instanceof Error && error.message.includes('retry') ? 'retryable' : 'fatal';
  }
}

export { FakeAdapter };
