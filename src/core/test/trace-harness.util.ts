import { TestModel } from '../../providers/test/test-model.enum.js';
import { DEFAULT_REPORT_SETTINGS } from '../report-settings.js';
import { RunScope } from '../state.js';
import { TraceReporter } from '../trace-reporter.js';
import type { OutputWriter } from '../trace-reporter.js';
import type { Verbosity } from '../verbosity.js';
import { ProviderFault } from './provider-fault.enum.js';
import { ReportHarness } from './report-harness.util.js';
import { RunCount } from './run-count.enum.js';
import { Threshold } from './threshold.enum.js';
import { TimeoutBudget } from './timeout-budget.enum.js';
import { OutputRecorder } from './output-recorder.fake.js';
import { TraceText } from './trace-text.enum.js';
import { VerbosityLevel } from './verbosity-level.enum.js';

class TraceHarness {
  output = new OutputRecorder();
  scope = new RunScope();

  constructor(public verbosity: Verbosity = VerbosityLevel.Debug) {}

  trace(write: OutputWriter = this.output.write): TraceReporter {
    return new TraceReporter(
      () => ({
        verbosity: this.verbosity,
        provider: TraceText.Provider,
        model: TestModel.Generic,
        meta: { [TraceText.MetaKey]: TraceText.MetaSecret },
        testDefaults: {},
        excerptChars: DEFAULT_REPORT_SETTINGS.excerptChars,
      }),
      this.scope,
      write,
    );
  }

  static everyEvent(trace: TraceReporter): void {
    trace.testStarted({ runs: RunCount.Smaller, threshold: Threshold.Half }, TimeoutBudget.SmokeMs);
    trace.providerRequest(
      TraceText.Provider,
      { model: TestModel.Generic, prompt: TraceText.Prompt },
      1,
    );
    trace.providerResponse(1, TraceText.Reply);
    trace.providerFailure(1, new Error(ProviderFault.InvalidKey), { next: 'fatal' });
    trace.judgeReplyRejected(1, new Error(TraceText.UnparseableReply));
    trace.judgeRecorded(ReportHarness.trueVerdict());
    trace.runSettled(1, ReportHarness.run('passed'));
    trace.testExpired(TimeoutBudget.SmokeMs, [ReportHarness.run('discarded')]);
  }

  occurrences(fragment: string): number {
    return this.output.text.split(fragment).length - 1;
  }
}

export { TraceHarness };
