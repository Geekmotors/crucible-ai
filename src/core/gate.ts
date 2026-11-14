import { BoundAssertions } from './bound-assertions.js';
import { DeclarationForms } from './declaration-forms.util.js';
import type { GroupBody } from './declaration-forms.util.js';
import { GroupSettings } from './group-settings.js';
import type { GroupCallback } from './group-settings.js';
import type { RunAssertions } from './run-assertions.js';
import type { RunHandle } from './run-handle.js';
import type { RunOptions } from './run-options.js';
import type { Runner } from './runner.js';

type GateBody = (t: RunAssertions, ...args: never[]) => unknown;
type GatedTest = (...args: unknown[]) => Promise<void>;
type GateDeclaration = { readonly test: GatedTest; readonly timeout: number };

class Gate {
  private static readonly SUBJECT = 'crucible.gate';

  private readonly forms = new DeclarationForms();

  constructor(
    private readonly runner: Runner,
    private readonly assertions: RunAssertions,
    private readonly groups: GroupSettings = new GroupSettings(),
  ) {}

  wrap(...args: unknown[]): GatedTest {
    const { opts, body } = this.forms.gate(Gate.SUBJECT, args);
    return this.declare(opts, body).test;
  }

  declare(own: RunOptions, body: GateBody): GateDeclaration {
    const opts = this.groups.inherit(own);
    const call = body as (t: RunAssertions, ...args: unknown[]) => unknown;
    const test: GatedTest = (...args) =>
      this.runner.execute((run: RunHandle) => call(this.bind(run), ...args), opts);
    return { test, timeout: this.runner.ceilingFor(opts) };
  }

  group(subject: string, options: RunOptions, callback: GroupBody): GroupCallback {
    return this.groups.declare(subject, options, callback);
  }

  private bind(run: RunHandle): RunAssertions {
    return new BoundAssertions(run, this.assertions);
  }
}

export { Gate };
export type { GateBody, GateDeclaration, GatedTest };
