import { describe, expect, it } from '@jest/globals';
import { CrucibleError } from './errors.js';
import { RetryingCompleter } from './retry.js';
import { TraceReporter } from './trace-reporter.js';
import { RetryHarness } from './test/retry-harness.util.js';
import { ScriptedAdapter } from './test/scripted-adapter.fake.js';
import { SleepRecorder } from './test/sleep-recorder.fake.js';
import { TraceHarness } from './test/trace-harness.util.js';
import { TraceText } from './test/trace-text.enum.js';
import { VerbosityLevel } from './test/verbosity-level.enum.js';

describe('RetryingCompleter', () => {
  it('propagates an abort rejection as-is without attempting', async () => {
    const reason = new Error('caller gave up');
    const adapter = new ScriptedAdapter([], 'retryable');
    const controller = new AbortController();
    controller.abort(reason);
    const rejection = new RetryingCompleter(
      new TraceReporter(),
      new SleepRecorder().sleep,
    ).complete(adapter, RetryHarness.request, controller.signal);
    await expect(rejection).rejects.toBe(reason);
  });

  it('retries a crucible infra error marked retryable instead of rethrowing it', async () => {
    const flake = new CrucibleError('infra', 'transient', { retryable: true });
    const adapter = new ScriptedAdapter([{ reject: flake }, { resolve: 'verdict' }], 'fatal');
    await expect(RetryHarness.run(adapter)).resolves.toBe('verdict');
  });

  it('an abort during the backoff wait means no further attempt is made — aborted runs must not spend', async () => {
    const reason = new Error('caller gave up mid-backoff');
    const controller = new AbortController();
    const adapter = new ScriptedAdapter([{ reject: new Error('flake') }], 'retryable');
    const abortingSleep = (): Promise<void> => {
      controller.abort(reason);
      return Promise.resolve();
    };
    const rejection = new RetryingCompleter(new TraceReporter(), abortingSleep).complete(
      adapter,
      RetryHarness.request,
      controller.signal,
    );
    await expect(rejection).rejects.toBe(reason);
    expect(adapter.calls).toBe(1);
  });

  it('never computes a negative backoff delay even with a hostile jitter source', async () => {
    const adapter = new ScriptedAdapter(
      [{ reject: new Error('one') }, { resolve: 'verdict' }],
      'retryable',
    );
    const recorder = new SleepRecorder();
    const completer = new RetryingCompleter(new TraceReporter(), recorder.sleep, {
      baseDelayMs: 100,
      jitter: () => -5,
    });
    await expect(
      completer.complete(adapter, RetryHarness.request, new AbortController().signal),
    ).resolves.toBe('verdict');
    expect(recorder.waits[0]).toBeGreaterThanOrEqual(0);
  });

  it('waits between retryable attempts, never after the final one', async () => {
    const adapter = new ScriptedAdapter(
      [{ reject: new Error('one') }, { reject: new Error('two') }, { resolve: 'verdict' }],
      'retryable',
    );
    const recorder = new SleepRecorder();
    await expect(RetryHarness.run(adapter, recorder)).resolves.toBe('verdict');
    expect(recorder.waits).toHaveLength(2);
  });
});

describe('RetryingCompleter — debug trace', () => {
  it('traces every request, the retryable failure with its backoff, and the response', async () => {
    const adapter = new ScriptedAdapter(
      [{ reject: new Error(TraceText.Flake) }, { resolve: TraceText.Reply }],
      'retryable',
    );
    const output = await RetryHarness.tracedOutput(adapter, new TraceHarness());
    expect(output).toContain('provider request attempt 1');
    expect(output).toContain('provider attempt 1 failed (retryable, retrying in');
    expect(output).toContain(TraceText.Flake);
    expect(output).toContain('provider request attempt 2');
    expect(output).toContain('provider response attempt 2');
    expect(output).toContain(TraceText.Reply);
  });

  it('traces a fatal failure as not retried', async () => {
    const adapter = new ScriptedAdapter([{ reject: new Error('unauthorized') }], 'fatal');
    const output = await RetryHarness.tracedOutput(adapter, new TraceHarness());
    expect(output).toContain('provider attempt 1 failed (fatal, not retried)');
  });

  it('traces the final retryable failure as out of attempts', async () => {
    const adapter = new ScriptedAdapter(
      [
        { reject: new Error('first') },
        { reject: new Error('second') },
        { reject: new Error('third') },
      ],
      'retryable',
    );
    const output = await RetryHarness.tracedOutput(adapter, new TraceHarness());
    expect(output).toContain('provider attempt 3 failed (retryable, but no attempts left)');
  });

  it('writes nothing below debug verbosity', async () => {
    const adapter = new ScriptedAdapter(
      [{ reject: new Error(TraceText.Flake) }, { resolve: TraceText.Reply }],
      'retryable',
    );
    const traced = new TraceHarness(VerbosityLevel.Full);
    await expect(RetryHarness.tracedOutput(adapter, traced)).resolves.toBe('');
  });
});
