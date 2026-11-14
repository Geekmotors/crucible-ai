import { CrucibleError } from './errors.js';
import { RunOptionsValidator } from './run-options-validator.util.js';
import type { RunOptions } from './run-options.js';

type GroupBody = () => unknown;

class GroupSettings {
  private static readonly SUBJECT = 'crucible.describe options';

  private readonly validator = new RunOptionsValidator();
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

  private static requireNothingReturned(result: unknown): void {
    if (GroupSettings.isThenable(result)) {
      Promise.resolve(result).catch(GroupSettings.ignore);
      throw new CrucibleError(
        'usage',
        'crucible.describe callbacks must be synchronous; declare tests directly, not after an await.',
      );
    }
    if (result !== undefined) {
      throw new CrucibleError(
        'usage',
        'crucible.describe callbacks must not return a value; declare tests inside the callback.',
      );
    }
  }

  private static ignore(): void {}

  declare(options: unknown, body: unknown): () => void {
    if (typeof body !== 'function') {
      throw new CrucibleError('usage', 'crucible.describe needs a callback function.');
    }
    const violation = this.validator.violation(options, GroupSettings.SUBJECT);
    if (violation !== undefined) {
      throw new CrucibleError('usage', violation);
    }
    const layer: RunOptions = { ...(options as RunOptions) };
    const callback = body as GroupBody;
    return () => this.collect(layer, callback);
  }

  inherit(own: RunOptions): RunOptions {
    return [...this.layers, own].reduce(GroupSettings.overlay, {});
  }

  private collect(layer: RunOptions, body: GroupBody): void {
    this.layers.push(layer);
    try {
      GroupSettings.requireNothingReturned(body());
    } finally {
      this.layers.pop();
    }
  }
}

export { GroupSettings };
export type { GroupBody };
