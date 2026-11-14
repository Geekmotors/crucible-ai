import type { CompletionRequest, FailureClass, ProviderAdapter } from '../../providers/types.js';

type Attempt = { resolve: string } | { reject: Error };

class ScriptedAdapter implements ProviderAdapter {
  name = 'scripted';
  envVar = 'SCRIPTED_API_KEY';
  calls = 0;
  overran = false;

  constructor(
    private attempts: Attempt[],
    private classification: FailureClass,
  ) {}

  complete(request: CompletionRequest, signal: AbortSignal): Promise<string> {
    if (signal.aborted) {
      return Promise.reject(signal.reason instanceof Error ? signal.reason : new Error('aborted'));
    }
    const attempt = this.attempts[this.calls];
    if (attempt === undefined) {
      this.overran = true;
      return Promise.reject(new Error('scripted adapter called past its script'));
    }
    this.calls += 1;
    return 'resolve' in attempt ? Promise.resolve(attempt.resolve) : Promise.reject(attempt.reject);
  }

  classifyFailure(): FailureClass {
    return this.classification;
  }
}

export { ScriptedAdapter };
export type { Attempt };
