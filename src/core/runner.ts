import { Aggregator } from './aggregator.util.js';
import { CrucibleError } from './errors.js';
import { JUDGE_CALL_TIMEOUT_MS } from './judge.js';
import { Reporter } from './reporter.util.js';
import { RunOptionsResolver } from './run-options-resolver.util.js';
import type { ResolvedRunOptions, RunOptions } from './run-options.js';
import type { RunResult } from './run-result.js';
import { RunScope, runScope } from './state.js';
import type { RunContext } from './state.js';
import { CrucibleVerdictError } from './verdict-error.js';

type Rethrow = { readonly rethrow: unknown };

type SettledRun = Rethrow | RunResult;

type InFlightRun = {
  readonly context: RunContext;
  readonly settled: Promise<SettledRun>;
};

type Batch =
  | { readonly halt: 'none'; readonly results: RunResult[] }
  | { readonly halt: 'rethrow'; readonly cause: unknown }
  | { readonly halt: 'fatal'; readonly cause: unknown; readonly results: RunResult[] };

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
    const batch = await this.runBatch(body, options.runs);
    if (batch.halt === 'rethrow') {
      throw batch.cause;
    }
    if (batch.halt === 'fatal') {
      throw new CrucibleVerdictError(
        'errored',
        this.reporter.renderAborted({ results: batch.results, options }),
        batch.cause,
      );
    }
    this.judge(batch.results, options);
  }

  private judge(results: RunResult[], options: ResolvedRunOptions): void {
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

  private runBatch(body: () => unknown, count: number): Promise<Batch> {
    const controller = new AbortController();
    const runs = Array.from({ length: count }, () => this.start(body, controller.signal));
    const settled: (RunResult | undefined)[] = runs.map(() => undefined);
    let pending = count;
    return new Promise<Batch>((resolve) => {
      runs.forEach((run, index) => {
        void run.settled.then((outcome) => {
          if (controller.signal.aborted) {
            return;
          }
          if ('rethrow' in outcome) {
            controller.abort();
            resolve({ halt: 'rethrow', cause: outcome.rethrow });
            return;
          }
          settled[index] = outcome;
          if (this.isFatal(outcome)) {
            controller.abort();
            resolve({
              halt: 'fatal',
              cause: outcome.cause,
              results: this.discardUnsettled(runs, settled),
            });
            return;
          }
          pending -= 1;
          if (pending === 0) {
            resolve({ halt: 'none', results: settled as RunResult[] });
          }
        });
      });
    });
  }

  private discardUnsettled(
    runs: readonly InFlightRun[],
    settled: readonly (RunResult | undefined)[],
  ): RunResult[] {
    return runs.map(
      (run, index) => settled[index] ?? { status: 'discarded', context: run.context },
    );
  }

  private start(body: () => unknown, signal: AbortSignal): InFlightRun {
    return this.scope.enterRun(
      () => ({ context: this.scope.context(), settled: this.settle(body) }),
      signal,
    );
  }

  private async settle(body: () => unknown): Promise<SettledRun> {
    try {
      await body();
      return { status: 'passed', context: this.scope.context() };
    } catch (cause) {
      return this.classify(cause);
    }
  }

  private classify(cause: unknown): SettledRun {
    if (cause instanceof CrucibleVerdictError) {
      return { rethrow: cause };
    }
    const crucible = this.firstCrucibleInChain(cause);
    if (crucible !== undefined && crucible.kind !== 'infra') {
      return { rethrow: cause };
    }
    const status = crucible !== undefined ? 'errored' : 'failed';
    return { status, cause, context: this.scope.context() };
  }

  private isFatal(result: RunResult): boolean {
    const crucible = this.firstCrucibleInChain(result.cause);
    return crucible?.kind === 'infra' && crucible.retryable !== true;
  }

  private firstCrucibleInChain(cause: unknown): CrucibleError | undefined {
    const visited = new Set<unknown>();
    let current = cause;
    while (current !== null && current !== undefined && !visited.has(current)) {
      if (current instanceof CrucibleError) {
        return current;
      }
      visited.add(current);
      current = current instanceof Error ? current.cause : undefined;
    }
    return undefined;
  }
}

export { Runner };
