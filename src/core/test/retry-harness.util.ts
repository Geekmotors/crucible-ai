import type { CompletionRequest, ProviderAdapter } from '../../providers/types.js';
import { TestModel } from '../../providers/test/test-model.enum.js';
import { RetryingCompleter } from '../retry.js';
import { TraceReporter } from '../trace-reporter.js';
import { Capture } from './capture.util.js';
import { SleepRecorder } from './sleep-recorder.fake.js';
import { TraceHarness } from './trace-harness.util.js';

class RetryHarness {
  static request: CompletionRequest = { model: TestModel.Generic, prompt: 'p' };

  static run(
    adapter: ProviderAdapter,
    recorder: SleepRecorder = new SleepRecorder(),
  ): Promise<string> {
    return new RetryingCompleter(new TraceReporter(), recorder.sleep).complete(
      adapter,
      RetryHarness.request,
      new AbortController().signal,
    );
  }

  static async tracedOutput(adapter: ProviderAdapter, traced: TraceHarness): Promise<string> {
    await new RetryingCompleter(traced.trace(), new SleepRecorder().sleep)
      .complete(adapter, RetryHarness.request, new AbortController().signal)
      .catch(() => undefined);
    return traced.output.text;
  }

  static failure(adapter: ProviderAdapter): Promise<unknown> {
    return Capture.rejection(RetryHarness.run(adapter));
  }
}

export { RetryHarness };
