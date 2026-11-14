import type { ExtractMode, ExtractType } from '../extract-type.js';
import { RunScope } from '../state.js';
import { EchoJudge } from './echo-judge.fake.js';
import { ExtractModeName } from './extract-mode-name.enum.js';
import { ExtractorHarness } from './extractor-harness.util.js';
import { FixtureOutcome } from './fixture-outcome.util.js';
import type { ObservedOutcome } from './fixture-outcome.util.js';
import { JudgeHarness } from './judge-harness.util.js';

type FactLayers = { facts?: string[]; callFacts?: string[] };

type CoherentInput = FactLayers & { response: string; claim: string };

type ExtractInput = FactLayers & {
  response: string;
  target: string;
  type: ExtractType;
  mode: ExtractMode;
};

class PayloadFixtureHarness {
  static coherent(input: unknown): Promise<ObservedOutcome> {
    const { facts, callFacts, response, claim } = input as CoherentInput;
    const scope = new RunScope();
    const judge = JudgeHarness.judge(new EchoJudge({ verdict: true }), scope);
    return FixtureOutcome.rendered(() =>
      scope.enterRun(async () => {
        scope.appendState(facts ?? []);
        await judge.judgeCoherent(response, claim, PayloadFixtureHarness.callOptions(callFacts));
        return scope.context().verdicts[0]?.reasoning;
      }),
    );
  }

  static extract(input: unknown): Promise<ObservedOutcome> {
    const { facts, callFacts, response, target, type, mode } = input as ExtractInput;
    const scope = new RunScope();
    const extractor = ExtractorHarness.extractor(new EchoJudge({ value: null }), scope);
    return FixtureOutcome.rendered(() =>
      scope.enterRun(async () => {
        scope.appendState(facts ?? []);
        await extractor.extract(response, target, {
          as: type,
          strict: mode === ExtractModeName.Strict,
          ...PayloadFixtureHarness.callOptions(callFacts),
        });
        return scope.context().extractions[0]?.reasoning;
      }),
    );
  }

  private static callOptions(callFacts: string[] | undefined): { facts?: string[] } {
    return callFacts === undefined ? {} : { facts: callFacts };
  }
}

export { PayloadFixtureHarness };
