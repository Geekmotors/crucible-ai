import { describe, expect, it } from '@jest/globals';
import { CrucibleError } from './errors.js';
import { Runner } from './runner.js';
import { RunScope } from './state.js';
import { BlockingAdapter } from './test/blocking-adapter.fake.js';
import { RunCount } from './test/run-count.enum.js';
import { Threshold } from './test/threshold.enum.js';
import { RunnerHarness } from './test/runner-harness.util.js';
import { StartGate } from './test/start-gate.util.js';
import { TimeoutBudget } from './test/timeout-budget.enum.js';
import { CrucibleVerdictError } from './verdict-error.js';

describe('Runner', () => {
  it('resolves when the run passes', async () => {
    await expect(new Runner(new RunScope()).execute(() => 'the value')).resolves.toBeUndefined();
  });

  it('executes the body once per declared run', async () => {
    await expect(RunnerHarness.executions({ runs: RunCount.Gated })).resolves.toBe(RunCount.Gated);
  });

  it('executes the body once in smoke mode', async () => {
    await expect(RunnerHarness.executions({})).resolves.toBe(RunCount.Single);
  });

  it('runs every body concurrently — all runs are in flight at once', async () => {
    const gate = new StartGate(RunCount.Gated);
    const behaviors = Array.from({ length: RunCount.Gated }, () => RunnerHarness.gated(gate));
    await expect(RunnerHarness.execute(behaviors, Threshold.Certain)).resolves.toBeUndefined();
  });

  it('isolates records per run — a concurrent run never sees another run’s records', async () => {
    const gate = new StartGate(RunCount.Gated);
    const behaviors = Array.from({ length: RunCount.Gated }, (_, index) =>
      RunnerHarness.isolated(gate, String(index)),
    );
    await expect(RunnerHarness.execute(behaviors, Threshold.Certain)).resolves.toBeUndefined();
  });

  it('passes 7 of 20 at threshold 0.35', async () => {
    const behaviors = RunnerHarness.behaviors(
      RunCount.LenientNeed,
      RunCount.Gated - RunCount.LenientNeed,
      new Error('miss'),
    );
    await expect(RunnerHarness.execute(behaviors, Threshold.Lenient)).resolves.toBeUndefined();
  });

  it('fails 6 of 20 at threshold 0.35 with a failed verdict', async () => {
    const behaviors = RunnerHarness.behaviors(
      RunCount.LenientNeed - 1,
      RunCount.Gated - RunCount.LenientNeed + 1,
      new Error('miss'),
    );
    const error = await RunnerHarness.executionRejection(behaviors, Threshold.Lenient);
    expect(error).toBeInstanceOf(CrucibleVerdictError);
    expect((error as CrucibleVerdictError).outcome).toBe('failed');
  });

  it('reports errored, not failed, when infra errors leave the pass rate inconclusive', async () => {
    const behaviors = [
      RunnerHarness.pass,
      RunnerHarness.throwing(new CrucibleError('infra', 'provider unreachable')),
      RunnerHarness.throwing(new Error('miss')),
    ];
    const error = await RunnerHarness.executionRejection(behaviors, Threshold.Half);
    expect(error).toBeInstanceOf(CrucibleVerdictError);
    expect((error as CrucibleVerdictError).outcome).toBe('errored');
  });

  it('carries the rejection of the first run matching the outcome as the cause', async () => {
    const first = new Error('first miss');
    const behaviors = [
      RunnerHarness.throwing(new CrucibleError('infra', 'outage', { retryable: true })),
      RunnerHarness.throwing(first),
      RunnerHarness.throwing(new Error('second miss')),
    ];
    const error = await RunnerHarness.executionRejection(behaviors, Threshold.Certain);
    expect((error as CrucibleVerdictError).cause).toBe(first);
  });

  it('rethrows a usage error from one of several runs untouched', async () => {
    const usage = new CrucibleError('usage', 'fix your setup');
    const behaviors = [
      RunnerHarness.throwing(new Error('miss')),
      RunnerHarness.throwing(usage),
      RunnerHarness.pass,
    ];
    const error = await RunnerHarness.executionRejection(behaviors, Threshold.Half);
    expect(error).toBe(usage);
  });

  it('keeps the 30 second smoke budget for a single run', () => {
    expect(new Runner(new RunScope()).timeoutFor(RunCount.Single)).toBe(TimeoutBudget.SmokeMs);
  });

  it('never shrinks the per-test budget as the run count grows', () => {
    const runner = new Runner(new RunScope());
    const budgets = Array.from({ length: RunCount.Gated }, (_, index) =>
      runner.timeoutFor(index + 1),
    );
    expect(budgets).toEqual([...budgets].sort((a, b) => a - b));
  });

  it('turns a rejection after a false verdict into a failed CrucibleVerdictError', async () => {
    const cause = new Error('expect(received).toBe(expected)');
    const error = await RunnerHarness.falseVerdictRejection(cause);
    expect(error).toBeInstanceOf(CrucibleVerdictError);
    expect((error as CrucibleVerdictError).outcome).toBe('failed');
    expect((error as CrucibleVerdictError).cause).toBe(cause);
  });

  it('turns an infra rejection into an errored CrucibleVerdictError', async () => {
    const cause = new CrucibleError('infra', 'provider unreachable');
    const error = await RunnerHarness.rejection(async (scope) => {
      scope.recordError({ cause, attempts: 1 });
      throw cause;
    });
    expect(error).toBeInstanceOf(CrucibleVerdictError);
    expect((error as CrucibleVerdictError).outcome).toBe('errored');
    expect((error as CrucibleVerdictError).cause).toBe(cause);
  });

  it('classifies a wrapped infra rejection as errored by walking the cause chain', async () => {
    const infra = new CrucibleError('infra', 'provider unreachable');
    const wrapped = new Error('re-thrown by user code', { cause: infra });
    const error = await RunnerHarness.rejection(async () => {
      throw wrapped;
    });
    expect(error).toBeInstanceOf(CrucibleVerdictError);
    expect((error as CrucibleVerdictError).outcome).toBe('errored');
    expect((error as CrucibleVerdictError).cause).toBe(wrapped);
  });

  it('turns a plain rejection with no records into a failed CrucibleVerdictError', async () => {
    const cause = new RangeError('index out of bounds');
    const error = await RunnerHarness.rejection(async () => {
      throw cause;
    });
    expect(error).toBeInstanceOf(CrucibleVerdictError);
    expect((error as CrucibleVerdictError).outcome).toBe('failed');
    expect((error as CrucibleVerdictError).cause).toBe(cause);
  });

  it.each(['config', 'usage'] as const)(
    'rethrows a %s error untouched — misconfiguration must not masquerade as a verdict',
    async (kind) => {
      const cause = new CrucibleError(kind, 'fix your setup');
      const error = await RunnerHarness.rejection(async () => {
        throw cause;
      });
      expect(error).toBe(cause);
    },
  );

  it('rethrows an already-wrapped CrucibleVerdictError untouched — no double wrapping', async () => {
    const inner = new CrucibleVerdictError('errored', 'already rendered', new Error('root'));
    const error = await RunnerHarness.rejection(async () => {
      throw inner;
    });
    expect(error).toBe(inner);
  });

  it.each([
    ['raw', RunnerHarness.fatal],
    ['wrapped by user code', new Error('re-thrown by user code', { cause: RunnerHarness.fatal })],
  ])(
    'a fatal provider error (%s) throws errored with its cause without waiting for siblings',
    async (_label, cause) => {
      const behaviors = [
        RunnerHarness.throwing(cause),
        ...Array.from({ length: RunCount.Gated - 1 }, () => RunnerHarness.never),
      ];
      const error = await RunnerHarness.executionRejection(behaviors, Threshold.Certain);
      expect(error).toBeInstanceOf(CrucibleVerdictError);
      expect((error as CrucibleVerdictError).outcome).toBe('errored');
      expect((error as CrucibleVerdictError).cause).toBe(cause);
    },
  );

  it('aborts every sibling run in flight on the first fatal provider error', async () => {
    const cancelled = new StartGate(RunCount.Gated);
    const behaviors = [
      RunnerHarness.throwing(RunnerHarness.fatal),
      ...Array.from({ length: RunCount.Gated - 1 }, () => RunnerHarness.awaitingAbort(cancelled)),
    ];
    await RunnerHarness.executionRejection(behaviors, Threshold.Certain);
    await expect(cancelled.arrive()).resolves.toBeUndefined();
  });

  it('a fatal provider error throws even when enough runs already passed', async () => {
    const gate = new StartGate(RunCount.Single + 1);
    const behaviors = [
      RunnerHarness.pass,
      RunnerHarness.gatedThrowing(gate, RunnerHarness.fatal),
      RunnerHarness.gated(gate),
    ];
    const error = await RunnerHarness.executionRejection(behaviors, Threshold.Minuscule);
    expect((error as CrucibleVerdictError).outcome).toBe('errored');
  });

  it('an infra error that exhausted its retries errors only its own run — siblings carry on', async () => {
    const gate = new StartGate(RunCount.Single + 2);
    const behaviors = [
      RunnerHarness.gatedThrowing(
        gate,
        new CrucibleError('infra', 'kept failing', { retryable: true }),
      ),
      RunnerHarness.gated(gate),
      RunnerHarness.gated(gate),
    ];
    await expect(RunnerHarness.execute(behaviors, Threshold.Half)).resolves.toBeUndefined();
  });

  it('a usage error aborts every sibling and is rethrown untouched without waiting', async () => {
    const usage = new CrucibleError('usage', 'fix your setup');
    const cancelled = new StartGate(RunCount.Gated);
    const behaviors = [
      RunnerHarness.throwing(usage),
      ...Array.from({ length: RunCount.Gated - 1 }, () => RunnerHarness.awaitingAbort(cancelled)),
    ];
    const error = await RunnerHarness.executionRejection(behaviors, Threshold.Certain);
    expect(error).toBe(usage);
    await expect(cancelled.arrive()).resolves.toBeUndefined();
  });

  it('a fatal judge call cancels every sibling judge call still in flight', async () => {
    const cancelled = new StartGate(RunCount.Gated);
    const adapter = new BlockingAdapter(cancelled, [new Error('401 invalid API key')]);
    const error = await RunnerHarness.judgedRejection(adapter, RunCount.Gated);
    expect((error as CrucibleVerdictError).outcome).toBe('errored');
    expect(((error as CrucibleVerdictError).cause as CrucibleError).kind).toBe('infra');
    expect(((error as CrucibleVerdictError).cause as CrucibleError).retryable).toBe(false);
    await expect(cancelled.arrive()).resolves.toBeUndefined();
  });
});
