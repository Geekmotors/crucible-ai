import type { CompletionRequest, FailureClass, ProviderAdapter } from '../../providers/types.js';
import { StartGate } from './start-gate.util.js';

class BlockingAdapter implements ProviderAdapter {
  name = 'blocking';
  envVar = 'BLOCKING_API_KEY';

  constructor(
    private cancelled: StartGate,
    private leadingFailures: Error[] = [],
  ) {}

  complete(_request: CompletionRequest, signal: AbortSignal): Promise<string> {
    const failure = this.leadingFailures.shift();
    if (failure !== undefined) {
      return Promise.reject(failure);
    }
    return new Promise<string>((_resolve, reject) => {
      const cancel = (): void => {
        void this.cancelled.arrive();
        reject(signal.reason);
      };
      if (signal.aborted) {
        cancel();
        return;
      }
      signal.addEventListener('abort', cancel, { once: true });
    });
  }

  classifyFailure(): FailureClass {
    return 'fatal';
  }
}

export { BlockingAdapter };
