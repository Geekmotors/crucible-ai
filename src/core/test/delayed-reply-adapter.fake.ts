import type { CompletionRequest, FailureClass, ProviderAdapter } from '../../providers/types.js';
import { ManualTimer } from './manual-timer.fake.js';

class DelayedReplyAdapter implements ProviderAdapter {
  name = 'delayed';
  envVar = 'DELAYED_API_KEY';
  started: Promise<void>;
  private markStarted: () => void = () => {};

  constructor(
    private timer: ManualTimer,
    private delayMs: number,
    private reply: string,
  ) {
    this.started = new Promise<void>((resolve) => {
      this.markStarted = resolve;
    });
  }

  complete(_request: CompletionRequest, signal: AbortSignal): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      const disarm = this.timer.arm(this.delayMs, () => resolve(this.reply));
      signal.addEventListener(
        'abort',
        () => {
          disarm();
          reject(signal.reason);
        },
        { once: true },
      );
      this.markStarted();
    });
  }

  classifyFailure(): FailureClass {
    return 'retryable';
  }
}

export { DelayedReplyAdapter };
