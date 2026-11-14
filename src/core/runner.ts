import { Aggregator } from './aggregator.util.js';
import { CrucibleError } from './errors.js';
import { Reporter } from './reporter.util.js';
import { RunOptionsResolver } from './run-options-resolver.util.js';
import type { ResolvedRunOptions, RunOptions } from './run-options.js';
import type { RunResult } from './run-result.js';
import type { RunHandle } from './run-handle.js';
import { RunScope, runScope } from './state.js';
import { TimeBudget } from './time-budget.util.js';
import type { RunLedger } from './state.js';
import { TraceReporter } from './trace-reporter.js';
import { CrucibleVerdictError } from './verdict-error.js';

type Rethrow = { readonly rethrow: unknown };

type SettledRun = Rethrow | RunResult;

type InFlightRun = {
  readonly context: RunLedger;
  readonly handle: RunHandle;
  readonly settled: Promise<SettledRun>;
};

type RunBody = (run: RunHandle) => unknown;

type Batch =
  | { readonly halt: 'none'; readonly results: RunResult[] }
  | { readonly halt: 'rethrow'; readonly cause: unknown }
  | { readonly halt: 'fatal'; readonly cause: unknown; readonly results: RunResult[] }
  | { readonly halt: 'expired'; readonly results: RunResult[] };

type TestDefaultsSupplier = () => RunOptions;
type DeadlineTimer = (ms: number, onExpire: () => void) => () => void;

class Runner {
  private static readonly CEILING_MARGIN_MS = 5000;

  private readonly resolver = new RunOptionsResolver();
  private readonly aggregator = new Aggregator();

  private static noTestDefaults(): RunOptions {
    return {};
  }

  private static startTimer(ms: number, onExpire: () => void): () => void {
    const handle = setTimeout(onExpire, ms);
    return () => clearTimeout(handle);
  }

  constructor(
    private readonly scope: RunScope = runScope,
    private readonly reporter: Reporter = new Reporter(),
    private readonly testDefaults: TestDefaultsSupplier = Runner.noTestDefaults,
    private readonly trace: TraceReporter = new TraceReporter(),
    private readonly timer: DeadlineTimer = Runner.startTimer,
  ) {}

  ceilingFor(declared: RunOptions): number {
    if (declared.testTimeout === undefined) {
      return TimeBudget.TIMER_MAX_MS;
    }
    return Math.min(TimeBudget.TIMER_MAX_MS, declared.testTimeout + Runner.CEILING_MARGIN_MS);
  }

  async execute(body: RunBody, opts: RunOptions = {}): Promise<void> {
    const options = this.resolver.resolve(opts, this.testDefaults());
    const deadlineMs = options.testTimeout;
    this.trace.testStarted(options, deadlineMs);
    const batch = await this.runBatch(body, options);
    if (batch.halt === 'rethrow') {
      throw batch.cause;
    }
    if (batch.halt === 'expired') {
      throw new CrucibleVerdictError(
        'errored',
        this.reporter.renderExpired({ results: batch.results, options, deadlineMs }),
        new CrucibleError('infra', `The test did not finish within ${deadlineMs} ms.`, {
          retryable: true,
        }),
      );
    }
    if (batch.halt === 'fatal') {
      throw new CrucibleVerdictError(
        'errored',
        this.reporter.renderAborted({ results: batch.results, options, fatal: batch.cause }),
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
    this.trace.verdictReached(tally, options);
    if (tally.zone === 'pass') {
      this.trace.reportPassed(() => this.reporter.renderPassed({ results, tally, options }));
      return;
    }
    const outcome = tally.zone === 'fail' ? 'failed' : 'errored';
    throw new CrucibleVerdictError(
      outcome,
      this.reporter.renderVerdict({ results, tally, options }),
      results.find((result) => result.status === outcome)?.cause,
    );
  }

  private async runBatch(body: RunBody, options: ResolvedRunOptions): Promise<Batch> {
    let release = (): void => {};
    try {
      return await new Promise<Batch>((resolve) => {
        release = this.collect(body, options, resolve);
      });
    } finally {
      release();
    }
  }

  private collect(
    body: RunBody,
    options: ResolvedRunOptions,
    resolve: (batch: Batch) => void,
  ): () => void {
    const controller = new AbortController();
    const runs = Array.from({ length: options.runs }, (_, index) =>
      this.start(body, controller.signal, index + 1, options),
    );
    const settled: (RunResult | undefined)[] = runs.map(() => undefined);
    let pending = options.runs;
    const disarmTimer = this.timer(options.testTimeout, () => {
      if (controller.signal.aborted) {
        return;
      }
      controller.abort();
      const results = this.discardUnsettled(runs, settled);
      this.trace.testExpired(options.testTimeout, results);
      resolve({ halt: 'expired', results });
    });
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
        this.trace.runSettled(index + 1, outcome);
        if (this.isFatal(outcome)) {
          controller.abort();
          const results = this.discardUnsettled(runs, settled);
          this.trace.testAborted(outcome.cause, results);
          resolve({ halt: 'fatal', cause: outcome.cause, results });
          return;
        }
        pending -= 1;
        if (pending === 0) {
          resolve({ halt: 'none', results: settled as RunResult[] });
        }
      });
    });
    return () => {
      disarmTimer();
      runs.forEach((run) => run.handle.close());
    };
  }

  private discardUnsettled(
    runs: readonly InFlightRun[],
    settled: readonly (RunResult | undefined)[],
  ): RunResult[] {
    return runs.map(
      (run, index) => settled[index] ?? { status: 'discarded', context: run.context },
    );
  }

  private start(
    body: RunBody,
    signal: AbortSignal,
    run: number,
    options: ResolvedRunOptions,
  ): InFlightRun {
    return this.scope.enterRun(
      () => {
        const handle = this.scope.handle();
        return { context: this.scope.context(), handle, settled: this.settle(body, handle) };
      },
      signal,
      run,
      options.inferenceTimeout,
      options.strict,
    );
  }

  private async settle(body: RunBody, handle: RunHandle): Promise<SettledRun> {
    try {
      await body(handle);
      return { status: 'passed', context: this.scope.context() };
    } catch (cause) {
      return this.classify(cause);
    } finally {
      handle.close();
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
export type { DeadlineTimer, RunBody, TestDefaultsSupplier };
