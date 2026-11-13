import { AsyncLocalStorage } from 'node:async_hooks';
import { CrucibleError } from './errors.js';

type VerdictRecord = {
  readonly assertion: string;
  readonly claim: string;
  readonly verdict: boolean;
  readonly reasoning: string;
  readonly response: string;
  readonly seq: number;
};

type ErrorRecord = {
  readonly cause: unknown;
  readonly attempts: number;
  readonly seq: number;
};

type RunContext = {
  readonly state: string[];
  readonly verdicts: VerdictRecord[];
  readonly errors: ErrorRecord[];
};

type RunStore = {
  readonly context: RunContext;
  seq: number;
};

class RunScope {
  private readonly storage = new AsyncLocalStorage<RunStore>();

  enterRun<T>(body: () => T): T {
    return this.storage.run({ context: { state: [], verdicts: [], errors: [] }, seq: 0 }, body);
  }

  context(): RunContext {
    return this.store().context;
  }

  appendState(entries: unknown): void {
    const store = this.store();
    for (const entry of this.stateEntries(entries)) {
      store.context.state.push(entry);
    }
  }

  recordVerdict(verdict: Omit<VerdictRecord, 'seq'>): VerdictRecord {
    const store = this.store();
    const record = { ...verdict, seq: this.takeSeq(store) };
    store.context.verdicts.push(record);
    return record;
  }

  recordError(error: Omit<ErrorRecord, 'seq'>): ErrorRecord {
    const store = this.store();
    const record = { ...error, seq: this.takeSeq(store) };
    store.context.errors.push(record);
    return record;
  }

  private stateEntries(entries: unknown): string[] {
    const candidates: unknown[] = Array.isArray(entries) ? Array.from(entries) : [entries];
    if (!candidates.every((entry) => typeof entry === 'string')) {
      throw new CrucibleError(
        'usage',
        'crucible.load and crucible.append take a string or an array of strings.',
      );
    }
    return candidates as string[];
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
        'This crucible call only works inside a running crucible.it test body.',
      );
    }
    return store;
  }
}

const runScope = new RunScope();

export { RunScope, runScope };
export type { ErrorRecord, RunContext, VerdictRecord };
