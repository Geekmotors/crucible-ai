import { InvalidFacts } from './invalid-facts.enum.js';
import { StateFact } from './state-fact.enum.js';

class FactsHarness {
  static invalid(): [InvalidFacts, unknown][] {
    return [
      [InvalidFacts.Number, 42],
      [InvalidFacts.Null, null],
      [InvalidFacts.Object, { fact: StateFact.Casino }],
      [InvalidFacts.MixedArray, [StateFact.Casino, 42]],
      [InvalidFacts.HoledArray, new Array<string>(1)],
      [InvalidFacts.StringObject, new String(StateFact.Casino)],
    ];
  }
}

export { FactsHarness };
