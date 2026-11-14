import type { GroupBody } from './declaration-forms.util.js';
import { CrucibleError } from './errors.js';
import type { RunOptions } from './run-options.js';

type GroupCallback = (...args: unknown[]) => void;

class GroupSettings {
  private readonly layers: RunOptions[] = [];

  private static overlay(base: RunOptions, top: RunOptions): RunOptions {
    const declared = Object.entries(top).filter(([, value]) => value !== undefined);
    return { ...base, ...Object.fromEntries(declared) };
  }

  private static isThenable(value: unknown): boolean {
    return (
      (typeof value === 'object' || typeof value === 'function') &&
      value !== null &&
      typeof (value as { then?: unknown }).then === 'function'
    );
  }

  private static requireNothingReturned(subject: string, result: unknown): void {
    if (GroupSettings.isThenable(result)) {
      Promise.resolve(result).catch(GroupSettings.ignore);
      throw new CrucibleError(
        'usage',
        `${subject} callbacks must be synchronous; declare tests directly, not after an await.`,
      );
    }
    if (result !== undefined) {
      throw new CrucibleError(
        'usage',
        `${subject} callbacks must not return a value; declare tests inside the callback.`,
      );
    }
  }

  private static ignore(): void {}

  declare(subject: string, options: RunOptions, callback: GroupBody): GroupCallback {
    const layer: RunOptions = { ...options };
    return (...args) => this.collect(subject, layer, () => callback(...args));
  }

  inherit(own: RunOptions): RunOptions {
    return [...this.layers, own].reduce(GroupSettings.overlay, {});
  }

  private collect(subject: string, layer: RunOptions, body: () => unknown): void {
    this.layers.push(layer);
    try {
      GroupSettings.requireNothingReturned(subject, body());
    } finally {
      this.layers.pop();
    }
  }
}

export { GroupSettings };
export type { GroupCallback };
