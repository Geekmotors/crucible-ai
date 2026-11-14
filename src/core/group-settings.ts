import type { GroupBody } from './declaration-forms.util.js';
import { CrucibleError } from './errors.js';
import type { RunOptions } from './run-options.js';
import type { GroupPath } from './runner-spec.js';

type GroupCallback = (...args: unknown[]) => void;

class GroupSettings {
  private readonly layers: RunOptions[] = [];
  private readonly declared = new WeakMap<object, RunOptions>();

  constructor(private readonly path?: GroupPath) {}

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
    return [...this.active(), own].reduce(GroupSettings.overlay, {});
  }

  private active(): RunOptions[] {
    if (this.path === undefined) {
      return this.layers;
    }
    return this.path().flatMap((group) => this.declared.get(group) ?? []);
  }

  private collect(subject: string, layer: RunOptions, body: () => unknown): void {
    if (this.path !== undefined) {
      this.declared.set(GroupSettings.enclosingGroup(subject, this.path), layer);
      GroupSettings.requireNothingReturned(subject, body());
      return;
    }
    this.layers.push(layer);
    try {
      GroupSettings.requireNothingReturned(subject, body());
    } finally {
      this.layers.pop();
    }
  }

  private static enclosingGroup(subject: string, path: GroupPath): object {
    const group = path().at(-1);
    if (group === undefined) {
      throw new CrucibleError(
        'usage',
        `${subject} callback ran outside the group the test runner created for it, so its settings cannot reach its tests; this test runner version is not supported.`,
      );
    }
    return group;
  }
}

export { GroupSettings };
export type { GroupCallback };
