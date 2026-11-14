import { describe, expect, it } from '@jest/globals';
import { BrokenWriter } from './test/broken-writer.fake.js';
import { TraceHarness } from './test/trace-harness.util.js';
import { TraceText } from './test/trace-text.enum.js';
import { VerbosityLevel } from './test/verbosity-level.enum.js';

describe('TraceReporter — below debug verbosity', () => {
  it('writes no live trace at full verbosity', () => {
    const harness = new TraceHarness(VerbosityLevel.Full);
    TraceHarness.everyEvent(harness.trace());
    expect(harness.output.text).toBe('');
  });
});

describe('TraceReporter — secrets in provider meta', () => {
  it('names meta keys but never meta values', () => {
    const harness = new TraceHarness();
    TraceHarness.everyEvent(harness.trace());
    expect(harness.output.text).toContain(TraceText.MetaKey);
    expect(harness.output.text).not.toContain(TraceText.MetaSecret);
  });
});

describe('TraceReporter — the passing report', () => {
  it('writes nothing at default verbosity', () => {
    const harness = new TraceHarness(VerbosityLevel.Default);
    TraceHarness.everyEvent(harness.trace());
    harness.trace().reportPassed(() => TraceText.ReportBody);
    expect(harness.output.text).toBe('');
  });

  it('writes the passing report at full verbosity', () => {
    const harness = new TraceHarness(VerbosityLevel.Full);
    harness.trace().reportPassed(() => TraceText.ReportBody);
    expect(harness.output.text).toBe(`${TraceText.ReportBody}\n`);
  });

  it('writes the passing report at debug verbosity', () => {
    const harness = new TraceHarness(VerbosityLevel.Debug);
    harness.trace().reportPassed(() => TraceText.ReportBody);
    expect(harness.output.text).toBe(`${TraceText.ReportBody}\n`);
  });
});

describe('TraceReporter — a broken output stream', () => {
  it('never fails its caller when the output stream breaks', () => {
    const harness = new TraceHarness();
    const trace = harness.trace(new BrokenWriter().write);
    expect(() => {
      TraceHarness.everyEvent(trace);
      trace.reportPassed(() => TraceText.ReportBody);
    }).not.toThrow();
  });
});
