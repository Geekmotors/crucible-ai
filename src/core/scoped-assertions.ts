import type { CoherentOptions, Facts } from './assertion-options.js';
import type { ExtractedValueFor, ExtractOptions } from './extract-type.js';
import type { Extractor } from './extractor.js';
import type { Judge } from './judge.js';
import type { RunAssertions } from './run-assertions.js';
import type { RunScope } from './state.js';

class ScopedAssertions implements RunAssertions {
  constructor(
    private readonly scope: RunScope,
    private readonly judge: () => Judge,
    private readonly extractor: () => Extractor,
  ) {}

  facts(fact: Facts): void {
    this.scope.appendState(fact);
  }

  coherent(actual: string, expectation: string, options?: CoherentOptions): Promise<boolean> {
    return this.judge().judgeCoherent(actual, expectation, options);
  }

  extract<O extends ExtractOptions | undefined = undefined>(
    text: string,
    description: string,
    options?: O,
  ): Promise<ExtractedValueFor<O>> {
    return this.extractor().extract(text, description, options) as Promise<ExtractedValueFor<O>>;
  }
}

export { ScopedAssertions };
