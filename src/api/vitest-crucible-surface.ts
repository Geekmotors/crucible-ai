import type { CrucibleCoreSurface } from './crucible-core-surface.js';
import type { VitestCrucibleDescribe } from './vitest-crucible-describe.js';
import type { VitestCrucibleIt } from './vitest-crucible-it.js';

type VitestCrucibleSurface = CrucibleCoreSurface & {
  /**
   * Registers a test with Vitest that executes its body `runs` times
   * concurrently and passes when at least `threshold` of the runs pass:
   * `crucible.it(name, [options,] async (t) => { ... }, [timeout])`. The
   * body receives `t`, not Vitest's test context. Also `crucible.it.only`,
   * `.skip`, `.todo`, `.each`, `.for`, `.skipIf`, `.runIf`, `.only.each`,
   * `.only.for`, `.skip.each` and `.skip.for`, with the same forms and
   * options.
   */
  it: VitestCrucibleIt;
  /**
   * Registers a Vitest `describe` block whose options every `crucible.it()`
   * inside inherits: `crucible.describe(name, [options,] () => { ... })`.
   * Also `crucible.describe.only`, `.skip`, `.todo`, `.each`, `.for`,
   * `.skipIf`, `.runIf`, `.only.each`, `.only.for`, `.skip.each` and
   * `.skip.for`, with the same forms and options.
   */
  describe: VitestCrucibleDescribe;
};

export type { VitestCrucibleSurface };
