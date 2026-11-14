import type { CoherentOptions, Facts } from './assertion-options.js';
import type { ExtractedValueFor, ExtractOptions } from './extract-type.js';

type RunAssertions = {
  facts(fact: Facts): void;
  coherent(actual: string, expectation: string, options?: CoherentOptions): Promise<boolean>;
  extract<O extends ExtractOptions | undefined = undefined>(
    text: string,
    description: string,
    options?: O,
  ): Promise<ExtractedValueFor<O>>;
};

export type { RunAssertions };
