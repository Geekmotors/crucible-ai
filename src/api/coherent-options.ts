import type { CoherentOptions as CoreCoherentOptions } from '../core/assertion-options.js';

type CoherentOptions = {
  /**
   * Facts for this call only, sent after the run's facts (from
   * `crucible.facts()`). They are not added to the run, so later calls do
   * not see them. One string or an array of strings.
   *
   * @default none: the call uses the run's facts alone
   */
  readonly facts?: CoreCoherentOptions['facts'];
};

export type { CoherentOptions };
