import { InvalidFacts } from './invalid-facts.enum.js';
import { StateFact } from './state-fact.enum.js';

class FactsHarness {
  static invalid(): [InvalidFacts, unknown][] {
    return [
      [InvalidFacts.HoledArray, new Array<string>(1)],
      [InvalidFacts.StringObject, new String(StateFact.Casino)],
    ];
  }
}

export { FactsHarness };
