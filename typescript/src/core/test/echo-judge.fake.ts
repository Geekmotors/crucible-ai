import type {
  Completion,
  CompletionRequest,
  FailureClass,
  ProviderAdapter,
} from '../../providers/types.js';

class EchoJudge implements ProviderAdapter {
  name = 'echo';
  envVar = 'ECHO_API_KEY';

  constructor(private answer: Record<string, unknown>) {}

  complete(request: CompletionRequest): Promise<Completion> {
    return Promise.resolve({
      reply: JSON.stringify({ ...this.answer, reasoning: request.prompt }),
      usage: {},
    });
  }

  classifyFailure(): FailureClass {
    return 'fatal';
  }
}

export { EchoJudge };
