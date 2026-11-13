import { Aggregator } from './aggregator.util.js';
import { CrucibleError } from './errors.js';
import { JUDGE_CALL_TIMEOUT_MS } from './judge.js';
import { Reporter } from './reporter.util.js';
import { RunOptionsResolver } from './run-options-resolver.util.js';
import type { RunOptions } from './run-options.js';
import type { RunResult } from './run-result.js';
import { RunScope, runScope } from './state.js';
import { CrucibleVerdictError } from './verdict-error.js';

type SettledRun = { readonly fatal: true; readonly cause: unknown } | RunResult;

class Runner {
  private static readonly RUN_BUDGET_MS = JUDGE_CALL_TIMEOUT_MS;
  private static readonly PER_EXTRA_RUN_MS = 1000;

  private readonly resolver = new RunOptionsResolver();
  private readonly aggregator = new Aggregator();

  constructor(
    private readonly scope: RunScope = runScope,
    private readonly reporter: Reporter = new Reporter(),
  ) {}

  timeoutFor(runs: number): number {
    return Runner.RUN_BUDGET_MS + (runs - 1) * Runner.PER_EXTRA_RUN_MS;
  }

  async execute(body: () => unknown, opts: RunOptions = {}): Promise<void> {
    const options = this.resolver.resolve(opts);
    const settled = await Promise.all(
      Array.from({ length: options.runs }, () => this.runOnce(body)),
    );
    const fatal = settled.find((run) => 'fatal' in run);
    if (fatal !== undefined) {
      throw fatal.cause;
    }
    const results = settled as RunResult[];
    const tally = this.aggregator.tally(
      results.map((result) => result.status),
      options,
    );
    if (tally.zone === 'pass') {
      return;
    }
    const outcome = tally.zone === 'fail' ? 'failed' : 'errored';
    throw new CrucibleVerdictError(
      outcome,
      this.reporter.renderVerdict({ results, tally, options }),
      results.find((result) => result.status === outcome)?.cause,
    );
  }

  private runOnce(body: () => unknown): Promise<SettledRun> {
    return this.scope.enterRun(async (): Promise<SettledRun> => {
      try {
        await body();
        return { status: 'passed', context: this.scope.context() };
      } catch (cause) {
        return this.classify(cause);
      }
    });
  }

  private classify(cause: unknown): SettledRun {
    if (cause instanceof CrucibleVerdictError) {
      return { fatal: true, cause };
    }
    const crucible = this.firstCrucibleInChain(cause);
    if (crucible !== undefined && crucible.kind !== 'infra') {
      return { fatal: true, cause };
    }
    const status = crucible !== undefined ? 'errored' : 'failed';
    return { status, cause, context: this.scope.context() };
  }

  private firstCrucibleInChain(cause: unknown): CrucibleError | undefined {
    let current = cause;
    while (current !== null && current !== undefined) {
      if (current instanceof CrucibleError) {
        return current;
      }
      current = current instanceof Error ? current.cause : undefined;
    }
    return undefined;
  }
}

export { Runner };
