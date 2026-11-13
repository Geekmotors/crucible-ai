import { TestModel } from '../../providers/test/test-model.enum.js';
import { Judge } from '../judge.js';
import { RetryingCompleter } from '../retry.js';
import { RunScope } from '../state.js';
import { Capture } from './capture.util.js';
import { ScriptedAdapter } from './scripted-adapter.fake.js';
import { SleepRecorder } from './sleep-recorder.fake.js';

class JudgeHarness {
  static judge(adapter: ScriptedAdapter, scope: RunScope): Judge {
    return new Judge(
      () => 'judge schema text',
      new RetryingCompleter(new SleepRecorder().sleep),
      () => ({ adapter, model: TestModel.Generic }),
      scope,
    );
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
