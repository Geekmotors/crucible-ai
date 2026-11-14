import type { CrucibleError } from '../errors.js';
import type { GroupBody } from '../declaration-forms.util.js';
import { GroupSettings } from '../group-settings.js';
import type { GroupCallback } from '../group-settings.js';
import type { GroupPath } from '../runner-spec.js';
import { RunOptionsResolver } from '../run-options-resolver.util.js';
import type { ResolvedRunOptions, RunOptions } from '../run-options.js';
import { Capture } from './capture.util.js';
import { DeclarationSubject } from './declaration-subject.enum.js';

class GroupSettingsHarness {
  groups: GroupSettings;
  private resolver = new RunOptionsResolver();

  constructor(path?: GroupPath) {
    this.groups = new GroupSettings(path);
  }

  declare(options: RunOptions, body: GroupBody): GroupCallback {
    return this.groups.declare(DeclarationSubject.Describe, options, body);
  }

  within(options: RunOptions, body: GroupBody): void {
    this.declare(options, body)();
  }

  resolve(own: RunOptions = {}, defaults: RunOptions = {}): ResolvedRunOptions {
    return this.resolver.resolve(this.groups.inherit(own), defaults);
  }

  static errorFrom(fn: () => unknown): CrucibleError {
    return Capture.thrown(fn) as CrucibleError;
  }
}

export { GroupSettingsHarness };
