import { BoundAssertions } from './bound-assertions.js';
import { CrucibleError } from './errors.js';
import { GroupSettings } from './group-settings.js';
import type { RunAssertions } from './run-assertions.js';
import type { RunHandle } from './run-handle.js';
import { RunOptionsValidator } from './run-options-validator.util.js';
import type { RunOptions } from './run-options.js';
import type { Runner } from './runner.js';

type GateBody = (t: RunAssertions, ...args: never[]) => unknown;
type GatedTest = (...args: unknown[]) => Promise<void>;
type GateDeclaration = { readonly test: GatedTest; readonly timeout: number };

class Gate {
  private static readonly SUBJECT = 'crucible.gate options';

  private readonly validator = new RunOptionsValidator();

  constructor(
    private readonly runner: Runner,
    private readonly assertions: RunAssertions,
    private readonly groups: GroupSettings = new GroupSettings(),
  ) {}

  wrap(optsOrBody: unknown, body?: unknown, ...surplus: unknown[]): GatedTest {
    if (typeof optsOrBody === 'function') {
      Gate.requireSingleBody(body);
      Gate.requireBodyLast(body);
      Gate.requireBodyLast(surplus.find((extra) => extra !== undefined));
      return this.declare({}, optsOrBody as GateBody).test;
    }
    const violation = this.validator.violation(optsOrBody, Gate.SUBJECT);
    if (violation !== undefined) {
      throw new CrucibleError('usage', violation);
    }
    if (typeof body !== 'function') {
      throw new CrucibleError('usage', 'crucible.gate needs a test body function.');
    }
    Gate.requireBodyLast(surplus.find((extra) => extra !== undefined));
    return this.declare({ ...(optsOrBody as RunOptions) }, body as GateBody).test;
  }

  declare(own: RunOptions, body: GateBody): GateDeclaration {
    const opts = this.groups.inherit(own);
    const call = body as (t: RunAssertions, ...args: unknown[]) => unknown;
    const test: GatedTest = (...args) =>
      this.runner.execute((run: RunHandle) => call(this.bind(run), ...args), opts);
    return { test, timeout: this.runner.ceilingFor(opts) };
  }

  group(options: unknown, body: unknown): () => void {
    return this.groups.declare(options, body);
  }

  private bind(run: RunHandle): RunAssertions {
    return new BoundAssertions(run, this.assertions);
  }

  private static requireSingleBody(second: unknown): void {
    if (typeof second === 'function') {
      throw new CrucibleError(
        'usage',
        'crucible.gate received two bodies; pass options first, then the body.',
      );
    }
  }

  private static requireBodyLast(surplus: unknown): void {
    if (surplus !== undefined) {
      throw new CrucibleError(
        'usage',
        'crucible.gate received an argument after the body; the body is the last argument.',
      );
    }
  }
}

export { Gate };
export type { GateBody, GateDeclaration, GatedTest };
