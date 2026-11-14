import type { CoherentOptions, Facts } from './assertion-options.js';
import type { ExtractedValueFor, ExtractOptions } from './extract-type.js';
import type { RunAssertions } from './run-assertions.js';
import type { RunHandle } from './run-handle.js';

class BoundAssertions implements RunAssertions {
  constructor(
    private readonly run: RunHandle,
    private readonly assertions: RunAssertions,
  ) {}

  facts = (fact: Facts): void => {
    this.run.within(() => this.assertions.facts(fact));
  };

  coherent = async (
    actual: string,
    expectation: string,
    options?: CoherentOptions,
  ): Promise<boolean> =>
    this.run.within(() => this.assertions.coherent(actual, expectation, options));

  extract = async <O extends ExtractOptions | undefined = undefined>(
    text: string,
    description: string,
    options?: O,
  ): Promise<ExtractedValueFor<O>> =>
    this.run.within(() => this.assertions.extract(text, description, options));
}

export { BoundAssertions };
