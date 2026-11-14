import script from '../stub/judge-replies.json' with { type: 'json' };
import type { JudgeScript } from './judge-script.js';
import { StubJudgeServer } from './stub-judge-server.util.js';

class StubJudgeHost {
  private server = new StubJudgeServer(script as JudgeScript);

  start(): Promise<void> {
    return this.server.start();
  }

  stop(): Promise<void> {
    return this.server.stop();
  }

  static async serve(): Promise<() => Promise<void>> {
    const host = new StubJudgeHost();
    await host.start();
    return () => host.stop();
  }
}

export { StubJudgeHost };
