import { CompositionRoot } from '../core/composition-root.js';
import type { ExtractedValueFor } from '../core/extract-type.js';
import type { RunnerSpec } from '../core/runner-spec.js';
import type { CoherentOptions } from './coherent-options.js';
import type { CrucibleCoreSurface } from './crucible-core-surface.js';
import type { ExtractOptions } from './extract-options.js';
import type { GateBody, GatedTest } from './run-context.js';
import type { RunOptions } from './run-options.js';

type RunnerSurface<It, Describe> = CrucibleCoreSurface & { it: It; describe: Describe };

class CrucibleApi {
  static build<It, Describe>(spec: RunnerSpec): Readonly<RunnerSurface<It, Describe>> {
    const root = new CompositionRoot(spec);
    return Object.freeze({
      it: root.runnerWrapper().test() as It,
      gate(optsOrBody: RunOptions | GateBody, body?: GateBody, ...surplus: unknown[]): GatedTest {
        return root.gate().wrap(optsOrBody, body, ...surplus);
      },
      describe: root.runnerWrapper().group() as Describe,
      coherent(actual: string, expectation: string, options?: CoherentOptions): Promise<boolean> {
        return root.assertions().coherent(actual, expectation, options);
      },
      extract<O extends ExtractOptions | undefined = undefined>(
        text: string,
        description: string,
        options?: O,
      ): Promise<ExtractedValueFor<O>> {
        return root.assertions().extract(text, description, options);
      },
      facts(fact: string | readonly string[]): void {
        root.assertions().facts(fact);
      },
      load(state: string | readonly string[]): void {
        root.assertions().facts(state);
      },
      append(state: string | readonly string[]): void {
        root.assertions().facts(state);
      },
    });
  }
}

export { CrucibleApi };
export type { RunnerSurface };
