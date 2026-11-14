import type { ProviderAdapter } from '../../providers/types.js';
import { TestModel } from '../../providers/test/test-model.enum.js';
import { Judge } from '../judge.js';
import { JudgeExchange } from '../judge-exchange.js';
import type { Deadline } from '../judge-exchange.js';
import { RetryingCompleter } from '../retry.js';
import { RunScope } from '../state.js';
import { TraceReporter } from '../trace-reporter.js';
import { BlockingAdapter } from './blocking-adapter.fake.js';
import { Capture } from './capture.util.js';
import { RunCount } from './run-count.enum.js';
import { StartGate } from './start-gate.util.js';
import { ScriptedAdapter } from './scripted-adapter.fake.js';
import { SleepRecorder } from './sleep-recorder.fake.js';
import { ClaimText } from './claim-text.enum.js';
import { CustomTimeout } from './custom-timeout.enum.js';
import { DelayedReplyAdapter } from './delayed-reply-adapter.fake.js';
import { ManualTimer } from './manual-timer.fake.js';
import { TimedDeadline } from './timed-deadline.fake.js';
import { TraceText } from './trace-text.enum.js';
import { TraceHarness } from './trace-harness.util.js';
import { FactAwareJudge } from './fact-aware-judge.fake.js';
import { VerdictReply } from './verdict-reply.enum.js';

class JudgeHarness {
  static schemaText = (): string => 'judge schema text';

  static exchange(
    adapter: ProviderAdapter,
    scope: RunScope,
    deadline?: Deadline,
    trace: TraceReporter = new TraceReporter(),
  ): JudgeExchange {
    return new JudgeExchange(
      new RetryingCompleter(trace, new SleepRecorder().sleep),
      () => ({ adapter, model: TestModel.Generic }),
      scope,
      trace,
      deadline,
    );
  }

  static judge(adapter: ProviderAdapter, scope: RunScope, deadline?: Deadline): Judge {
    return new Judge(
      JudgeHarness.schemaText,
      JudgeHarness.exchange(adapter, scope, deadline),
      scope,
      new TraceReporter(),
    );
  }

  static factJudge(scope: RunScope, facts: readonly string[]): Judge {
    return JudgeHarness.judge(
      new FactAwareJudge(facts, VerdictReply.Coherent, VerdictReply.Contradicted),
      scope,
    );
  }

  static timedJudge(adapter: ProviderAdapter, scope: RunScope, timer: ManualTimer): Judge {
    return JudgeHarness.judge(adapter, scope, new TimedDeadline(timer).signal);
  }

  static async slowReply(inferenceTimeout?: number): Promise<boolean> {
    const timer = new ManualTimer();
    const scope = new RunScope();
    const adapter = new DelayedReplyAdapter(timer, CustomTimeout.SlowReply, TraceText.Reply);
    const judge = JudgeHarness.timedJudge(adapter, scope, timer);
    const pending = scope.enterRun(
      () => judge.judgeCoherent('the response', 'the claim'),
      undefined,
      undefined,
      inferenceTimeout,
    );
    await adapter.started;
    timer.advance(CustomTimeout.SlowReply);
    return pending;
  }

  static async blockedFailure(inferenceTimeout: number, advanceMs: number): Promise<unknown> {
    const timer = new ManualTimer();
    const scope = new RunScope();
    const judge = JudgeHarness.timedJudge(
      new BlockingAdapter(new StartGate(RunCount.Single)),
      scope,
      timer,
    );
    const pending = scope.enterRun(
      () => Capture.rejection(judge.judgeCoherent('the response', 'the claim')),
      undefined,
      undefined,
      inferenceTimeout,
    );
    timer.advance(advanceMs);
    return pending;
  }

  static async tracedOutput(replies: string[], traced: TraceHarness): Promise<string> {
    const trace = traced.trace();
    const judge = new Judge(
      JudgeHarness.schemaText,
      JudgeHarness.exchange(
        new ScriptedAdapter(
          replies.map((reply) => ({ resolve: reply })),
          'retryable',
        ),
        traced.scope,
        undefined,
        trace,
      ),
      traced.scope,
      trace,
    );
    await traced.scope
      .enterRun(() => judge.judgeCoherent('the response', ClaimText.KeepsSecret))
      .catch(() => undefined);
    return traced.output.text;
  }

  static judgeReplies(replies: string[]): Promise<boolean> {
    const scope = new RunScope();
    const judge = JudgeHarness.judge(
      new ScriptedAdapter(
        replies.map((reply) => ({ resolve: reply })),
        'retryable',
      ),
      scope,
    );
    return scope.enterRun(() => judge.judgeCoherent('the response', 'the claim'));
  }

  static judgeReply(reply: string): Promise<boolean> {
    return JudgeHarness.judgeReplies([reply, reply]);
  }

  static async replyFailure(reply: string): Promise<unknown> {
    return Capture.rejection(JudgeHarness.judgeReply(reply));
  }
}

export { JudgeHarness };
