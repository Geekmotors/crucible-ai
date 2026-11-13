import { CrucibleError } from '../core/errors.js';
import { Runner } from '../core/runner.js';
import { RunOptionsResolver } from '../core/run-options-resolver.util.js';
import type { RunOptions } from '../core/run-options.js';

type TestBody = () => unknown;
type Registrar = (name: string, fn: () => Promise<void>, timeout?: number) => void;
type Declaration = { readonly opts: RunOptions; readonly body: TestBody };

class JestBinding {
  private readonly resolver: RunOptionsResolver = new RunOptionsResolver();

  private static lazyJestRegistrar(name: string, fn: () => Promise<void>, timeout?: number): void {
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

  constructor(
    private readonly runner: Runner,
    private readonly registrar: Registrar = JestBinding.lazyJestRegistrar,
  ) {}

  register(
    name: string,
    optsOrBody: RunOptions | TestBody,
    bodyOrTimeout?: TestBody | number,
    timeout?: number,
  ): void {
    const { opts, body } = this.normalize(optsOrBody, bodyOrTimeout, timeout);
    this.registrar(name, () => this.runner.execute(body, opts), this.runner.ceilingFor(opts));
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
