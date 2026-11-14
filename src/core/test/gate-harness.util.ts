import { CrucibleError } from '../errors.js';
import { Gate } from '../gate.js';
import type { GateBody, GatedTest } from '../gate.js';
import { GroupSettings } from '../group-settings.js';
import type { RunAssertions } from '../run-assertions.js';
import type { RunOptions } from '../run-options.js';
import { ScopedAssertions } from '../scoped-assertions.js';
import { RunScope } from '../state.js';
import { TimeBudget } from '../time-budget.util.js';
import { Capture } from './capture.util.js';
import { ClaimText } from './claim-text.enum.js';
import { ExtractorHarness } from './extractor-harness.util.js';
import { ExtractTarget } from './extract-target.enum.js';
import { ExtractText } from './extract-text.enum.js';
import { ExtractValue } from './extract-value.enum.js';
import { InvalidGateCall } from './invalid-gate-call.enum.js';
import { JudgedResponse } from './judged-response.enum.js';
import { JudgeHarness } from './judge-harness.util.js';
import { ManualTimer } from './manual-timer.fake.js';
import { RunContextCall } from './run-context-call.enum.js';
import { RunCount } from './run-count.enum.js';
import { RunnerHarness } from './runner-harness.util.js';
import { StateFact } from './state-fact.enum.js';
import { Threshold } from './threshold.enum.js';

class GateHarness {
  static smoke: RunOptions = { runs: RunCount.Single, threshold: Threshold.Certain };

  scope = new RunScope();
  timer = new ManualTimer();
  groups = new GroupSettings();
  assertions: ScopedAssertions;

  constructor(
    facts: readonly string[] = [StateFact.Casino],
    private defaults: RunOptions = {},
  ) {
    this.assertions = new ScopedAssertions(
      this.scope,
      () => JudgeHarness.factJudge(this.scope, facts),
      () => ExtractorHarness.factExtractor(this.scope, facts),
    );
  }

  gate(): Gate {
    return new Gate(
      RunnerHarness.runner(this.scope, this.timer, this.defaults),
      this.assertions,
      this.groups,
    );
  }

  wrap(...args: unknown[]): GatedTest {
    const [optsOrBody, body, ...surplus] = args;
    return this.gate().wrap(optsOrBody, body, ...surplus);
  }

  wrapInGroup(groupOptions: RunOptions, ...args: unknown[]): GatedTest {
    let test: GatedTest | undefined;
    this.groups.declare(groupOptions, () => {
      test = this.wrap(...args);
    })();
    return test!;
  }

  async contextAfterRun(): Promise<RunAssertions> {
    let captured: RunAssertions | undefined;
    await this.wrap(GateHarness.smoke, (t: RunAssertions) => {
      captured = t;
    })();
    return captured!;
  }

  async contextAfterFailedRun(): Promise<RunAssertions> {
    let captured: RunAssertions | undefined;
    await Capture.rejection(
      this.wrap(GateHarness.smoke, (t: RunAssertions) => {
        captured = t;
        throw new Error();
      })(),
    );
    return captured!;
  }

  async contextOfDiscardedRun(): Promise<RunAssertions> {
    let captured: RunAssertions | undefined;
    const pending = Capture.rejection(
      this.wrap(GateHarness.smoke, (t: RunAssertions) => {
        captured = t;
        return new Promise<void>(() => {});
      })(),
    );
    this.timer.advance(TimeBudget.testTimeoutFor(RunCount.Single));
    await pending;
    return captured!;
  }

  static async requireSeen(assertions: RunAssertions): Promise<void> {
    if (!(await assertions.coherent(JudgedResponse.Default, ClaimText.Default))) {
      throw new Error('the judge did not see the expected facts');
    }
  }

  static async call(t: RunAssertions, call: RunContextCall): Promise<unknown> {
    if (call === RunContextCall.Facts) {
      t.facts(StateFact.Casino);
      return undefined;
    }
    if (call === RunContextCall.Coherent) {
      return t.coherent(JudgedResponse.Default, ClaimText.Default);
    }
    return t.extract(ExtractText.Response, ExtractTarget.Apples, { as: 'number' });
  }

  static async extractsSeen(t: RunAssertions): Promise<void> {
    const value = await t.extract(ExtractText.Response, ExtractTarget.Apples, { as: 'number' });
    if (value !== ExtractValue.Two) {
      throw new Error('the extraction did not see the expected facts');
    }
  }

  static async callError(t: RunAssertions, call: RunContextCall): Promise<unknown> {
    return Capture.rejection(GateHarness.call(t, call));
  }

  static kind(error: unknown): string | undefined {
    return error instanceof CrucibleError ? error.kind : undefined;
  }

  static emptyBody: GateBody = () => {};

  static invalidCalls(): [InvalidGateCall, unknown[]][] {
    return [
      [InvalidGateCall.NoArguments, []],
      [InvalidGateCall.OptionsWithoutBody, [GateHarness.smoke]],
      [InvalidGateCall.TwoBodies, [GateHarness.emptyBody, GateHarness.emptyBody]],
      [InvalidGateCall.ArgumentAfterBody, [GateHarness.emptyBody, RunCount.Single]],
      [
        InvalidGateCall.ArgumentAfterAnEmptySlot,
        [GateHarness.emptyBody, undefined, RunCount.Single],
      ],
      [
        InvalidGateCall.ArgumentAfterOptionsAndBody,
        [GateHarness.smoke, GateHarness.emptyBody, RunCount.Single],
      ],
      [
        InvalidGateCall.ArgumentAfterOptionsBodyAndAnEmptySlot,
        [GateHarness.smoke, GateHarness.emptyBody, undefined, RunCount.Single],
      ],
      [InvalidGateCall.InvalidOptions, [{ runs: RunCount.Single - 1 }, GateHarness.emptyBody]],
      [InvalidGateCall.NonObjectOptions, [RunCount.Single, GateHarness.emptyBody]],
    ];
  }
}

export { GateHarness };
