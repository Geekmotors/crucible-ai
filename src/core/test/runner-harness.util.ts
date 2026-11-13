import type { ProviderAdapter } from '../../providers/types.js';
import { CrucibleError } from '../errors.js';
import { Reporter } from '../reporter.util.js';
import { Runner } from '../runner.js';
import type { RunOptions } from '../run-options.js';
import { RunScope } from '../state.js';
import type { VerdictRecord } from '../state.js';
import { Capture } from './capture.util.js';
import { JudgeHarness } from './judge-harness.util.js';
import { ManualTimer } from './manual-timer.fake.js';
import { ProviderFault } from './provider-fault.enum.js';
import { StartGate } from './start-gate.util.js';

type RunBehavior = (scope: RunScope) => Promise<void>;

class RunnerHarness {
  static runner(
    scope: RunScope = new RunScope(),
    timer: ManualTimer = new ManualTimer(),
    defaults: RunOptions = {},
  ): Runner {
    return new Runner(scope, new Reporter(), () => defaults, timer.arm);
  }

  static failingDefaultsRunner(cause: unknown): Runner {
    return new Runner(
      new RunScope(),
      new Reporter(),
      () => {
        throw cause;
      },
      new ManualTimer().arm,
    );
  }

  static async rejection(body: (scope: RunScope) => Promise<never>): Promise<unknown> {
    const scope = new RunScope();
    return Capture.rejection(RunnerHarness.runner(scope).execute(() => body(scope)));
  }

  static async falseVerdictRejection(cause: unknown): Promise<unknown> {
    return RunnerHarness.rejection(async (scope) => {
      RunnerHarness.recordVerdict(scope, false);
      throw cause;
    });
  }

  static execute(behaviors: RunBehavior[], threshold: number): Promise<void> {
    return RunnerHarness.executeWith(behaviors, { runs: behaviors.length, threshold });
  }

  static executeWith(
    behaviors: RunBehavior[],
    opts: RunOptions,
    defaults: RunOptions = {},
    timer: ManualTimer = new ManualTimer(),
  ): Promise<void> {
    const scope = new RunScope();
    let next = 0;
    const body = (): Promise<void> => {
      const behavior = behaviors[next];
      next += 1;
      return behavior!(scope);
    };
    return RunnerHarness.runner(scope, timer, defaults).execute(body, opts);
  }

  static async executionRejection(behaviors: RunBehavior[], threshold: number): Promise<unknown> {
    return Capture.rejection(RunnerHarness.execute(behaviors, threshold));
  }

  static behaviors(passed: number, failed: number, failure: unknown): RunBehavior[] {
    return [
      ...Array.from({ length: passed }, () => RunnerHarness.pass),
      ...Array.from({ length: failed }, () => RunnerHarness.throwing(failure)),
    ];
  }

  static pass: RunBehavior = async () => {};

  static fatal = new CrucibleError('infra', ProviderFault.InvalidKey, { retryable: false });

  static throwing(cause: unknown): RunBehavior {
    return async () => {
      throw cause;
    };
  }

  static cyclic(): Error {
    const outer = new Error('outer');
    const inner = new Error('inner', { cause: outer });
    outer.cause = inner;
    return outer;
  }

  static never: RunBehavior = () => new Promise<void>(() => {});

  static awaitingAbort(cancelled: StartGate): RunBehavior {
    return (scope) =>
      new Promise<void>((resolve) => {
        scope.abortSignal().addEventListener(
          'abort',
          () => {
            void cancelled.arrive();
            resolve();
          },
          { once: true },
        );
      });
  }

  static gatedThrowing(gate: StartGate, cause: unknown): RunBehavior {
    return async () => {
      await gate.arrive();
      throw cause;
    };
  }

  static async judgedRejection(adapter: ProviderAdapter, runs: number): Promise<unknown> {
    const scope = new RunScope();
    const judge = JudgeHarness.judge(adapter, scope);
    return Capture.rejection(
      RunnerHarness.runner(scope).execute(() => judge.judgeCoherent('the response', 'the claim'), {
        runs,
      }),
    );
  }

  static gated(gate: StartGate): RunBehavior {
    return async () => {
      await gate.arrive();
    };
  }

  static isolated(gate: StartGate, claim: string): RunBehavior {
    return async (scope) => {
      scope.recordVerdict({ ...RunnerHarness.verdict(true), claim });
      await gate.arrive();
      const claims = scope.context().verdicts.map((record) => record.claim);
      if (claims.length !== 1 || claims[0] !== claim) {
        throw new Error(`run ${claim} saw records of other runs: ${claims.join(', ')}`);
      }
    };
  }

  static async executions(opts: RunOptions, defaults: RunOptions = {}): Promise<number> {
    let executed = 0;
    await RunnerHarness.runner(new RunScope(), new ManualTimer(), defaults).execute(() => {
      executed += 1;
    }, opts);
    return executed;
  }

  static async executionsBeforeRejection(runner: Runner): Promise<number> {
    let executed = 0;
    await Capture.rejection(
      runner.execute(() => {
        executed += 1;
      }),
    );
    return executed;
  }

  private static recordVerdict(scope: RunScope, verdict: boolean): void {
    scope.recordVerdict(RunnerHarness.verdict(verdict));
  }

  private static verdict(verdict: boolean): Omit<VerdictRecord, 'seq'> {
    return {
      assertion: 'coherent',
      claim: 'the claim',
      verdict,
      reasoning: 'the reasoning',
      response: 'the response',
    };
  }
}

export { RunnerHarness };
export type { RunBehavior };
