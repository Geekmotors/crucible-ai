import type { AsyncLocalStorage } from 'node:async_hooks';
import { CrucibleError } from './errors.js';
import type { RunStore } from './state.js';

class RunHandle {
  private open = true;

  constructor(
    private readonly store: RunStore,
    private readonly storage: AsyncLocalStorage<RunStore>,
  ) {}

  within<T>(fn: () => T): T {
    if (!this.open) {
      throw new CrucibleError(
        'usage',
        'This run context belongs to a run that has ended; use t only while its own run is running.',
      );
    }
    return this.storage.run(this.store, fn);
  }

  close(): void {
    this.open = false;
  }
}

export { RunHandle };
