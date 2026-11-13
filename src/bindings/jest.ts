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

  register(name: string, optsOrBody: RunOptions | TestBody, maybeBody?: TestBody): void {
    const { opts, body } = this.normalize(optsOrBody, maybeBody);
    this.registrar(name, () => this.runner.execute(body, opts), this.runner.ceilingFor(opts));
  }

  private normalize(optsOrBody: RunOptions | TestBody, maybeBody?: TestBody): Declaration {
    if (typeof optsOrBody === 'function') {
      if (maybeBody !== undefined) {
        throw new CrucibleError(
          'usage',
          'crucible.it received two bodies; pass options first, then the body.',
        );
      }
      return { opts: {}, body: optsOrBody };
    }
    this.resolver.validate(optsOrBody);
    if (typeof maybeBody !== 'function') {
      throw new CrucibleError('usage', 'crucible.it needs a test body function.');
    }
    return { opts: optsOrBody, body: maybeBody };
  }
}

export { JestBinding };
export type { Registrar, TestBody };
