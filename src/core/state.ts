import { AsyncLocalStorage } from 'node:async_hooks';
import { CrucibleError } from './errors.js';
import type { ExtractedValue, ExtractMode, ExtractType } from './extract-type.js';
import { FactList } from './fact-list.util.js';
import { RunHandle } from './run-handle.js';
import { TimeBudget } from './time-budget.util.js';

type JudgedRecord = {
  readonly assertion: string;
  readonly reasoning: string;
  readonly response: string;
  readonly facts: readonly string[];
  readonly seq: number;
};

type VerdictRecord = JudgedRecord & {
  readonly claim: string;
  readonly verdict: boolean;
};

type ExtractionRecord = JudgedRecord & {
  readonly description: string;
  readonly type: ExtractType;
  readonly mode: ExtractMode;
  readonly value: ExtractedValue;
};

type ErrorRecord = {
  readonly cause: unknown;
  readonly attempts: number;
  readonly seq: number;
};

type RunLedger = {
  readonly state: string[];
  readonly verdicts: VerdictRecord[];
  readonly extractions: ExtractionRecord[];
  readonly errors: ErrorRecord[];
};

type RunStore = {
  readonly context: RunLedger;
  readonly signal: AbortSignal;
  readonly run?: number;
  readonly inferenceTimeout: number;
  readonly strict: boolean;
  seq: number;
};

class RunScope {
  private readonly storage = new AsyncLocalStorage<RunStore>();
  private readonly factList = new FactList();

  enterRun<T>(
    body: () => T,
    signal: AbortSignal = new AbortController().signal,
    run?: number,
    inferenceTimeout: number = TimeBudget.INFERENCE_MS,
    strict: boolean = false,
  ): T {
    return this.storage.run(
      {
        context: { state: [], verdicts: [], extractions: [], errors: [] },
        signal,
        run,
        inferenceTimeout,
        strict,
        seq: 0,
      },
      body,
    );
  }

  handle(): RunHandle {
    return new RunHandle(this.store(), this.storage);
  }

  runNumber(): number | undefined {
    return this.storage.getStore()?.run;
  }

  context(): RunLedger {
    return this.store().context;
  }

  abortSignal(): AbortSignal {
    return this.store().signal;
  }

  inferenceTimeout(): number {
    return this.store().inferenceTimeout;
  }

  strict(): boolean {
    return this.store().strict;
  }

  appendState(entries: unknown): void {
    const store = this.store();
    for (const entry of this.factList.entries(entries)) {
      store.context.state.push(entry);
    }
  }

  recordVerdict(verdict: Omit<VerdictRecord, 'seq'>): VerdictRecord {
    const store = this.store();
    const record = { ...verdict, seq: this.takeSeq(store) };
    store.context.verdicts.push(record);
    return record;
  }

  recordExtraction(extraction: Omit<ExtractionRecord, 'seq'>): ExtractionRecord {
    const store = this.store();
    const record = { ...extraction, seq: this.takeSeq(store) };
    store.context.extractions.push(record);
    return record;
  }

  recordError(error: Omit<ErrorRecord, 'seq'>): ErrorRecord {
    const store = this.store();
    const record = { ...error, seq: this.takeSeq(store) };
    store.context.errors.push(record);
    return record;
  }

  private takeSeq(store: RunStore): number {
    const seq = store.seq;
    store.seq += 1;
    return seq;
  }

  private store(): RunStore {
    const store = this.storage.getStore();
    if (store === undefined) {
      throw new CrucibleError(
        'usage',
        'This crucible call only works inside a running crucible.it or crucible.gate test body.',
      );
    }
    return store;
  }
}

const runScope = new RunScope();

export { RunScope, runScope };
export type { ErrorRecord, ExtractionRecord, JudgedRecord, RunLedger, RunStore, VerdictRecord };
