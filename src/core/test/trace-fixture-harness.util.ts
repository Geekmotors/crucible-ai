import type { RunOptions } from '../run-options.js';
import type { RunResult, VerdictZone } from '../run-result.js';
import { RunScope } from '../state.js';
import { TraceReporter } from '../trace-reporter.js';
import type { ProviderFailureOutcome, TraceSettings } from '../trace-reporter.js';
import type { VerdictOutcome } from '../verdict-error.js';
import type { Verbosity } from '../verbosity.js';
import { FixtureOutcome } from './fixture-outcome.util.js';
import type { ObservedOutcome } from './fixture-outcome.util.js';
import { NeutralRun } from './neutral-run.util.js';
import type { NeutralCall, NeutralCause, NeutralRunRecord } from './neutral-run.util.js';
import { OutputRecorder } from './output-recorder.fake.js';
import { Threshold } from './threshold.enum.js';

type TraceEvent = { run?: number } & (
  | { event: 'test-started'; runs: number; threshold: number; deadlineMs: number }
  | ({ event: 'run-settled'; number: number } & NeutralRunRecord)
  | { event: 'test-aborted'; cause: NeutralCause; discarded: number }
  | { event: 'test-expired'; deadlineMs: number; discarded: number }
  | {
      event: 'verdict-reached';
      outcome: VerdictOutcome | 'passed';
      need: number;
      passed: number;
      failed: number;
      errored: number;
      runs: number;
    }
  | {
      event: 'provider-request';
      provider: string;
      model: string;
      system?: string;
      meta?: Record<string, unknown>;
      prompt: string;
      attempt: number;
    }
  | { event: 'provider-response'; attempt: number; reply: string }
  | {
      event: 'provider-failure';
      attempt: number;
      cause: NeutralCause;
      next: ProviderFailureOutcome['next'];
      delayMs?: number;
    }
  | { event: 'judge-reply-rejected'; ask: number; cause: NeutralCause }
  | { event: 'judge-recorded'; call: NeutralCall }
);

type TraceInput = {
  settings: Omit<TraceSettings, 'testDefaults' | 'verbosity'> & {
    verbosity: Verbosity;
    testDefaults: RunOptions;
  };
  events: TraceEvent[];
};

class TraceFixtureHarness {
  private static zones: Record<VerdictOutcome | 'passed', VerdictZone> = {
    passed: 'pass',
    failed: 'fail',
    errored: 'errored',
  };

  static trace(input: unknown): Promise<ObservedOutcome> {
    const { settings, events } = input as TraceInput;
    const output = new OutputRecorder();
    const scope = new RunScope();
    const trace = new TraceReporter(() => settings, scope, output.write);
    return FixtureOutcome.rendered(() => {
      for (const event of events) {
        if (event.run === undefined) {
          TraceFixtureHarness.emit(trace, event);
        } else {
          scope.enterRun(() => TraceFixtureHarness.emit(trace, event), undefined, event.run);
        }
      }
      return output.text;
    });
  }

  private static discarded(count: number): RunResult[] {
    return Array.from({ length: count }, () => NeutralRun.result({ status: 'discarded' }));
  }

  private static emit(trace: TraceReporter, event: TraceEvent): void {
    switch (event.event) {
      case 'test-started':
        trace.testStarted({ runs: event.runs, threshold: event.threshold }, event.deadlineMs);
        return;
      case 'run-settled':
        trace.runSettled(event.number, NeutralRun.result(event));
        return;
      case 'test-aborted':
        trace.testAborted(
          NeutralRun.cause(event.cause),
          TraceFixtureHarness.discarded(event.discarded),
        );
        return;
      case 'test-expired':
        trace.testExpired(event.deadlineMs, TraceFixtureHarness.discarded(event.discarded));
        return;
      case 'verdict-reached':
        trace.verdictReached(
          {
            zone: TraceFixtureHarness.zones[event.outcome],
            need: event.need,
            passed: event.passed,
            failed: event.failed,
            errored: event.errored,
          },
          { runs: event.runs, threshold: Threshold.Certain },
        );
        return;
      case 'provider-request':
        trace.providerRequest(
          event.provider,
          { model: event.model, system: event.system, prompt: event.prompt, meta: event.meta },
          event.attempt,
        );
        return;
      case 'provider-response':
        trace.providerResponse(event.attempt, event.reply);
        return;
      case 'provider-failure':
        trace.providerFailure(
          event.attempt,
          NeutralRun.cause(event.cause),
          event.next === 'retry'
            ? { next: 'retry', delayMs: event.delayMs ?? 0 }
            : { next: event.next },
        );
        return;
      case 'judge-reply-rejected':
        trace.judgeReplyRejected(event.ask, NeutralRun.cause(event.cause));
        return;
      case 'judge-recorded':
        trace.judgeRecorded(NeutralRun.record(event.call, 0));
        return;
    }
  }
}

export { TraceFixtureHarness };
