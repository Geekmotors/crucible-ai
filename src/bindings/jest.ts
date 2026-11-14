import { CrucibleError } from '../core/errors.js';
import type { Gate, GatedTest } from '../core/gate.js';
import type { GroupBody } from '../core/group-settings.js';
import type { RunAssertions } from '../core/run-assertions.js';
import { RunOptionsResolver } from '../core/run-options-resolver.util.js';
import type { RunOptions } from '../core/run-options.js';

type TestBody = (t: RunAssertions) => unknown;
type Registrar = (name: string, fn: GatedTest, timeout?: number) => void;
type GroupRegistrar = (name: string, fn: () => void) => void;
type Declaration = { readonly opts: RunOptions; readonly body: TestBody };

class JestBinding {
  private readonly resolver: RunOptionsResolver = new RunOptionsResolver();

  private static lazyJestRegistrar(name: string, fn: GatedTest, timeout?: number): void {
    const registrar = (globalThis as { it?: Registrar }).it;
    if (typeof registrar !== 'function') {
      throw new CrucibleError(
        'usage',
        'crucible.it needs Jest with injected globals: no callable global "it" was found ' +
          '(injectGlobals: false is not supported in v1).',
      );
    }
    registrar(name, fn, timeout);
  }

  private static lazyJestGroupRegistrar(name: string, fn: () => void): void {
    const registrar = (globalThis as { describe?: GroupRegistrar }).describe;
    if (typeof registrar !== 'function') {
      throw new CrucibleError(
        'usage',
        'crucible.describe needs Jest with injected globals: no callable global "describe" was found ' +
          '(injectGlobals: false is not supported in v1).',
      );
    }
    registrar(name, fn);
  }

  constructor(
    private readonly gate: Gate,
    private readonly registrar: Registrar = JestBinding.lazyJestRegistrar,
    private readonly groupRegistrar: GroupRegistrar = JestBinding.lazyJestGroupRegistrar,
  ) {}

  group(
    name: string,
    optsOrBody: RunOptions | GroupBody,
    body?: GroupBody,
    ...surplus: unknown[]
  ): void {
    if (typeof optsOrBody === 'function') {
      JestBinding.requireCallbackLast(body);
      this.groupRegistrar(name, this.gate.group({}, optsOrBody));
      return;
    }
    JestBinding.requireCallbackLast(surplus[0]);
    this.groupRegistrar(name, this.gate.group(optsOrBody, body));
  }

  private static requireCallbackLast(surplus: unknown): void {
    if (surplus !== undefined) {
      throw new CrucibleError(
        'usage',
        'crucible.describe received an argument after the callback; the callback is the last argument.',
      );
    }
  }

  register(
    name: string,
    optsOrBody: RunOptions | TestBody,
    bodyOrTimeout?: TestBody | number,
    timeout?: number,
  ): void {
    const { opts, body } = this.normalize(optsOrBody, bodyOrTimeout, timeout);
    const declared = this.gate.declare(opts, body);
    this.registrar(name, declared.test, declared.timeout);
  }

  private normalize(
    optsOrBody: RunOptions | TestBody,
    bodyOrTimeout?: TestBody | number,
    timeout?: number,
  ): Declaration {
    if (typeof optsOrBody === 'function') {
      if (typeof bodyOrTimeout === 'function') {
        throw new CrucibleError(
          'usage',
          'crucible.it received two bodies; pass options first, then the body.',
        );
      }
      return this.declaration({}, optsOrBody, bodyOrTimeout, timeout);
    }
    this.resolver.validate(optsOrBody);
    if (typeof bodyOrTimeout !== 'function') {
      throw new CrucibleError('usage', 'crucible.it needs a test body function.');
    }
    return this.declaration(optsOrBody, bodyOrTimeout, timeout);
  }

  private declaration(
    opts: RunOptions,
    body: TestBody,
    timeout?: unknown,
    surplus?: unknown,
  ): Declaration {
    if (surplus !== undefined) {
      throw new CrucibleError(
        'usage',
        'crucible.it received an argument after the timeout; the timeout is the last argument.',
      );
    }
    if (timeout === undefined) {
      return { opts, body };
    }
    if (opts.testTimeout !== undefined) {
      throw new CrucibleError(
        'usage',
        'crucible.it received both a trailing timeout and a testTimeout option; pass only one.',
      );
    }
    const withTimeout = { ...opts, testTimeout: timeout };
    this.resolver.validate(withTimeout);
    return { opts: withTimeout, body };
  }
}

export { JestBinding };
export type { Registrar, TestBody };
