import type { CompletionRequest, FailureClass, ProviderAdapter } from '../../providers/types.js';

class EchoJudge implements ProviderAdapter {
  name = 'echo';
  envVar = 'ECHO_API_KEY';

  constructor(private answer: Record<string, unknown>) {}

  complete(request: CompletionRequest): Promise<string> {
    return Promise.resolve(JSON.stringify({ ...this.answer, reasoning: request.prompt }));
  }

  classifyFailure(): FailureClass {
    return 'fatal';
  }
}

export { EchoJudge };
