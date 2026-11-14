import type { CrucibleError } from '../errors.js';
import { GroupSettings } from '../group-settings.js';
import { RunOptionsResolver } from '../run-options-resolver.util.js';
import type { ResolvedRunOptions, RunOptions } from '../run-options.js';
import { Capture } from './capture.util.js';

class GroupSettingsHarness {
  groups = new GroupSettings();
  private resolver = new RunOptionsResolver();

  within(options: unknown, body: unknown): void {
    this.groups.declare(options, body)();
  }

  resolve(own: RunOptions = {}, defaults: RunOptions = {}): ResolvedRunOptions {
    return this.resolver.resolve(this.groups.inherit(own), defaults);
  }

  static errorFrom(fn: () => unknown): CrucibleError {
    return Capture.thrown(fn) as CrucibleError;
  }
}

export { GroupSettingsHarness };
