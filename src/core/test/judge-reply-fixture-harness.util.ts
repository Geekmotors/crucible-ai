import type { ExtractType } from '../extract-type.js';
import { RunScope } from '../state.js';
import type { ScriptedAdapter } from './scripted-adapter.fake.js';
import { ExtractTarget } from './extract-target.enum.js';
import { ExtractText } from './extract-text.enum.js';
import { ExtractorHarness } from './extractor-harness.util.js';
import { FixtureOutcome } from './fixture-outcome.util.js';
import type { ObservedOutcome } from './fixture-outcome.util.js';
import { JudgeHarness } from './judge-harness.util.js';
import { JudgedResponse } from './judged-response.enum.js';
import { ClaimText } from './claim-text.enum.js';

type ReplyInput =
  { ask: 'coherent'; replies: string[] } | { ask: 'extract'; type: ExtractType; replies: string[] };

class JudgeReplyFixtureHarness {
  static async reply(input: unknown): Promise<ObservedOutcome> {
    const reply = input as ReplyInput;
    const adapter = ExtractorHarness.scripted(reply.replies);
    const outcome = await FixtureOutcome.settled(() =>
      reply.ask === 'coherent'
        ? JudgeReplyFixtureHarness.verdict(adapter)
        : JudgeReplyFixtureHarness.extraction(reply.type, adapter),
    );
    FixtureOutcome.requireEnoughScript(adapter.overran);
    return outcome;
  }

  private static verdict(adapter: ScriptedAdapter): Promise<unknown> {
    const scope = new RunScope();
    const judge = JudgeHarness.judge(adapter, scope);
    return scope.enterRun(async () => {
      const verdict = await judge.judgeCoherent(JudgedResponse.Default, ClaimText.Default);
      return { verdict, reasoning: scope.context().verdicts[0]?.reasoning };
    });
  }

  private static extraction(type: ExtractType, adapter: ScriptedAdapter): Promise<unknown> {
    const scope = new RunScope();
    const extractor = ExtractorHarness.extractor(adapter, scope);
    return scope.enterRun(async () => {
      const value = await extractor.extract(ExtractText.Response, ExtractTarget.Apples, {
        as: type,
      });
      return { value, reasoning: scope.context().extractions[0]?.reasoning };
    });
  }
}

export { JudgeReplyFixtureHarness };
