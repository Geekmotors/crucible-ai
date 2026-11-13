import { describe, expect, it } from '@jest/globals';
import { TestModel } from '../providers/test/test-model.enum.js';
import { CrucibleError } from './errors.js';
import { BrokenWriter } from './test/broken-writer.fake.js';
import { MultilineText } from './test/multiline-text.enum.js';
import { ProviderFault } from './test/provider-fault.enum.js';
import { ReportHarness } from './test/report-harness.util.js';
import { RunCount } from './test/run-count.enum.js';
import { Threshold } from './test/threshold.enum.js';
import { TimeoutBudget } from './test/timeout-budget.enum.js';
import { TraceBound } from './test/trace-bound.enum.js';
import { TraceHarness } from './test/trace-harness.util.js';
import { TraceText } from './test/trace-text.enum.js';
import { VerbosityLevel } from './test/verbosity-level.enum.js';

describe('TraceReporter — quiet levels', () => {
  it('writes nothing at default verbosity', () => {
    const harness = new TraceHarness(VerbosityLevel.Default);
    TraceHarness.everyEvent(harness.trace());
    harness.trace().reportPassed(() => TraceText.ReportBody);
    expect(harness.output.text).toBe('');
  });

  it('writes no live trace at full verbosity', () => {
    const harness = new TraceHarness(VerbosityLevel.Full);
    TraceHarness.everyEvent(harness.trace());
    expect(harness.output.text).toBe('');
  });

  it('writes the passing report at full verbosity', () => {
    const harness = new TraceHarness(VerbosityLevel.Full);
    harness.trace().reportPassed(() => TraceText.ReportBody);
    expect(harness.output.text).toContain(TraceText.ReportBody);
  });

  it('writes the passing report at debug verbosity', () => {
    const harness = new TraceHarness(VerbosityLevel.Debug);
    harness.trace().reportPassed(() => TraceText.ReportBody);
    expect(harness.output.text).toContain(TraceText.ReportBody);
  });
});

describe('TraceReporter — debug trace', () => {
  it('opens with engine init and the resolved config, once', () => {
    const harness = new TraceHarness();
    const trace = harness.trace();
    TraceHarness.everyEvent(trace);
    TraceHarness.everyEvent(trace);
    expect(harness.occurrences(TraceText.EngineInit)).toBe(1);
    expect(harness.occurrences(TraceText.ConfigResolved)).toBe(1);
    expect(harness.output.text.indexOf(TraceText.EngineInit)).toBeLessThan(
      harness.output.text.indexOf(TraceText.TestStarted),
    );
    expect(harness.output.text).toContain(TestModel.Generic);
  });

  it('names meta keys but never meta values, which may hold secrets', () => {
    const harness = new TraceHarness();
    TraceHarness.everyEvent(harness.trace());
    expect(harness.output.text).toContain(TraceText.MetaKey);
    expect(harness.output.text).not.toContain(TraceText.MetaSecret);
  });

  it('marks every line as crucible debug output', () => {
    const harness = new TraceHarness();
    TraceHarness.everyEvent(harness.trace());
    const lines = harness.output.text.split('\n').filter((line) => line.length > 0);
    expect(lines.every((line) => line.startsWith(TraceText.Prefix) || line.startsWith(' '))).toBe(
      true,
    );
  });

  it('tags provider traffic inside a run with that run number', () => {
    const harness = new TraceHarness();
    const trace = harness.trace();
    harness.scope.enterRun(
      () => trace.providerResponse(1, TraceText.Reply),
      new AbortController().signal,
      RunCount.Smaller,
    );
    expect(harness.output.text).toContain(`run #${RunCount.Smaller}`);
    expect(harness.output.text).toContain(TraceText.Reply);
  });

  it('shows the provider request prompt and model', () => {
    const harness = new TraceHarness();
    harness
      .trace()
      .providerRequest(
        TraceText.Provider,
        { model: TestModel.Generic, prompt: TraceText.Prompt },
        1,
      );
    expect(harness.output.text).toContain(TraceText.Prompt);
    expect(harness.output.text).toContain(TestModel.Generic);
  });

  it('bounds a long prompt and states its full length', () => {
    const harness = new TraceHarness();
    const prompt = 'p'.repeat(TraceBound.PayloadChars + 1);
    harness.trace().providerRequest(TraceText.Provider, { model: TestModel.Generic, prompt }, 1);
    expect(harness.output.text).not.toContain(prompt);
    expect(harness.output.text).toContain(`${TraceBound.PayloadChars + 1} chars`);
  });

  it('bounds a long reply and states its full length', () => {
    const harness = new TraceHarness();
    const reply = 'r'.repeat(TraceBound.PayloadChars + 1);
    harness.trace().providerResponse(1, reply);
    expect(harness.output.text).not.toContain(reply);
    expect(harness.output.text).toContain(`${TraceBound.PayloadChars + 1} chars`);
  });

  it('keeps every line of a multi-line cause inside the trace block', () => {
    const harness = new TraceHarness();
    harness
      .trace()
      .runSettled(RunCount.Smaller, ReportHarness.run('failed', new Error(MultilineText.Flush)));
    const lines = harness.output.text.split('\n').filter((line) => line.length > 0);
    expect(lines.every((line) => line.startsWith(TraceText.Prefix) || line.startsWith(' '))).toBe(
      true,
    );
  });

  it('never fails its caller when the output stream breaks', () => {
    const harness = new TraceHarness();
    const trace = harness.trace(new BrokenWriter().write);
    expect(() => {
      TraceHarness.everyEvent(trace);
      trace.reportPassed(() => TraceText.ReportBody);
    }).not.toThrow();
  });

  it('shows the system prompt by length only', () => {
    const harness = new TraceHarness();
    harness
      .trace()
      .providerRequest(
        TraceText.Provider,
        { model: TestModel.Generic, system: TraceText.SystemPrompt, prompt: TraceText.Prompt },
        1,
      );
    expect(harness.output.text).not.toContain(TraceText.SystemPrompt);
    expect(harness.output.text).toContain(`system prompt ${TraceText.SystemPrompt.length} chars`);
  });

  it('states a retryable provider failure, its cause and the backoff before the next attempt', () => {
    const harness = new TraceHarness();
    harness.trace().providerFailure(1, new Error(ProviderFault.InvalidKey), {
      next: 'retry',
      delayMs: TraceBound.BackoffMs,
    });
    expect(harness.output.text).toContain(ProviderFault.InvalidKey);
    expect(harness.output.text).toContain(`${TraceBound.BackoffMs} ms`);
  });

  it('states a recorded verdict with its claim', () => {
    const harness = new TraceHarness();
    harness.trace().judgeRecorded(ReportHarness.falseVerdict());
    expect(harness.output.text).toContain(ReportHarness.falseVerdict().claim);
    expect(harness.output.text).toContain(TraceText.VerdictFalse);
  });

  it('states a recorded judge error with its cause', () => {
    const harness = new TraceHarness();
    harness.trace().judgeRecorded({
      cause: new CrucibleError('infra', ProviderFault.InvalidKey),
      attempts: 3,
      seq: 0,
    });
    expect(harness.output.text).toContain(ProviderFault.InvalidKey);
  });

  it('states how each run settled', () => {
    const harness = new TraceHarness();
    harness.trace().runSettled(RunCount.Smaller, ReportHarness.run('failed', new Error('miss')));
    expect(harness.output.text).toContain(`run #${RunCount.Smaller}`);
    expect(harness.output.text).toContain('failed');
    expect(harness.output.text).toContain('miss');
  });

  it('states the run count, threshold and deadline when a test starts', () => {
    const harness = new TraceHarness();
    harness
      .trace()
      .testStarted({ runs: RunCount.Smaller, threshold: Threshold.Half }, TimeoutBudget.SmokeMs);
    expect(harness.output.text).toContain(`${RunCount.Smaller} run(s)`);
    expect(harness.output.text).toContain(String(Threshold.Half));
    expect(harness.output.text).toContain(`${TimeoutBudget.SmokeMs} ms`);
  });

  it('states the verdict zone with the pass count and need', () => {
    const harness = new TraceHarness();
    const { tally, options } = ReportHarness.summary(
      ReportHarness.runs(RunCount.Smaller, 'passed'),
      Threshold.Half,
    );
    harness.trace().verdictReached(tally, options);
    expect(harness.output.text).toContain(TraceText.VerdictPass);
    expect(harness.output.text).toContain(`need ${tally.need}`);
  });

  it('states a fatal abort with its cause', () => {
    const harness = new TraceHarness();
    harness
      .trace()
      .testAborted(new CrucibleError('infra', ProviderFault.InvalidKey), [
        ReportHarness.run('discarded'),
      ]);
    expect(harness.output.text).toContain(ProviderFault.InvalidKey);
    expect(harness.output.text).toContain(TraceText.OneDiscarded);
  });
});
