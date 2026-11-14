import type { Facts } from '../assertion-options.js';
import { ScopedAssertions } from '../scoped-assertions.js';
import { RunScope } from '../state.js';
import { EchoJudge } from './echo-judge.fake.js';
import { ExtractorHarness } from './extractor-harness.util.js';
import { FixtureOutcome } from './fixture-outcome.util.js';
import type { ObservedOutcome } from './fixture-outcome.util.js';
import { JudgeHarness } from './judge-harness.util.js';
import { SpecialValue } from './special-value.util.js';

type Assertion = 'coherent' | 'extract';

type CallInput = { assertion: Assertion; facts?: unknown[]; strict?: boolean; args: unknown[] };

type Ask = (assertions: ScopedAssertions, args: unknown[]) => Promise<unknown>;

class AssertionCallFixtureHarness {
  private static asks: Record<Assertion, Ask> = {
    coherent: (assertions, args) =>
      assertions.coherent(...(args as Parameters<ScopedAssertions['coherent']>)),
    extract: (assertions, args) =>
      assertions.extract(...(args as Parameters<ScopedAssertions['extract']>)),
  };

  static call(input: unknown): Promise<ObservedOutcome> {
    const { assertion, facts, strict, args } = SpecialValue.decode(input) as CallInput;
    const scope = new RunScope();
    const judge = JudgeHarness.judge(new EchoJudge({ verdict: true }), scope);
    const extractor = ExtractorHarness.extractor(new EchoJudge({ value: null }), scope);
    const assertions = new ScopedAssertions(
      scope,
      () => judge,
      () => extractor,
    );
    return FixtureOutcome.rendered(() =>
      scope.enterRun(
        async () => {
          for (const fact of facts ?? []) {
            assertions.facts(fact as Facts);
          }
          await AssertionCallFixtureHarness.asks[assertion](assertions, args);
          const { verdicts, extractions } = scope.context();
          return [...verdicts, ...extractions][0]?.reasoning;
        },
        undefined,
        undefined,
        undefined,
        strict ?? false,
      ),
    );
  }
}

export { AssertionCallFixtureHarness };
