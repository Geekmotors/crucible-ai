import type { CrucibleCoreSurface } from './crucible-core-surface.js';
import type { CrucibleDescribe } from './crucible-describe.js';
import type { CrucibleIt } from './crucible-it.js';

type CrucibleSurface = CrucibleCoreSurface & {
  /**
   * Registers a test with your runner that executes its body `runs` times
   * concurrently and passes when at least `threshold` of the runs pass:
   * `crucible.it(name, [options,] async (t) => { ... }, [timeout])`. Also
   * `crucible.it.only`, `.skip`, `.todo`, `.each`, `.only.each` and
   * `.skip.each`, with the same forms and options.
   */
  it: CrucibleIt;
  /**
   * Registers a `describe` block whose options every `crucible.it()` inside
   * inherits: `crucible.describe(name, [options,] () => { ... })`. Also
   * `crucible.describe.only`, `.skip`, `.each`, `.only.each` and
   * `.skip.each`, with the same forms and options.
   */
  describe: CrucibleDescribe;
};

export type { CrucibleSurface };
