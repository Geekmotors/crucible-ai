import type { ProviderAdapter } from '../../providers/types.js';
import { TestModel } from '../../providers/test/test-model.enum.js';
import { Judge } from '../judge.js';
import type { Deadline } from '../judge.js';
import { RetryingCompleter } from '../retry.js';
import { RunScope } from '../state.js';
import { TraceReporter } from '../trace-reporter.js';
import { Capture } from './capture.util.js';
import { ScriptedAdapter } from './scripted-adapter.fake.js';
import { SleepRecorder } from './sleep-recorder.fake.js';
import { ClaimText } from './claim-text.enum.js';
import { TraceHarness } from './trace-harness.util.js';

class JudgeHarness {
  static schemaText = (): string => 'judge schema text';

  static judge(adapter: ProviderAdapter, scope: RunScope, deadline?: Deadline): Judge {
    return new Judge(
      JudgeHarness.schemaText,
      new RetryingCompleter(new TraceReporter(), new SleepRecorder().sleep),
      () => ({ adapter, model: TestModel.Generic }),
      scope,
      new TraceReporter(),
      deadline,
    );
  }

  static async tracedOutput(replies: string[], traced: TraceHarness): Promise<string> {
    const trace = traced.trace();
    const judge = new Judge(
      JudgeHarness.schemaText,
      new RetryingCompleter(trace, new SleepRecorder().sleep),
      () => ({
        adapter: new ScriptedAdapter(
          replies.map((reply) => ({ resolve: reply })),
          'retryable',
        ),
        model: TestModel.Generic,
      }),
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
