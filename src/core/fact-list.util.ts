import { CrucibleError } from './errors.js';

class FactList {
  entries(facts: unknown): string[] {
    const candidates: unknown[] = Array.isArray(facts) ? Array.from(facts) : [facts];
    if (!candidates.every((entry) => typeof entry === 'string')) {
      throw new CrucibleError(
        'usage',
        'crucible.facts and the facts option take a string or an array of strings.',
      );
    }
    return candidates as string[];
  }

  optional(facts: unknown): string[] {
    return facts === undefined ? [] : this.entries(facts);
  }
}

export { FactList };
