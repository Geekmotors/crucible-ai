import type { ExtractionRecord, VerdictRecord } from '../state.js';
import { AssertionName } from './assertion-name.enum.js';
import { ExtractModeName } from './extract-mode-name.enum.js';

class StateHarness {
  static verdict(claim: string): Omit<VerdictRecord, 'seq'> {
    return {
      assertion: AssertionName.Coherent,
      claim,
      verdict: true,
      reasoning: 'consistent',
      response: 'the response',
      facts: [],
    };
  }

  static extraction(description: string): Omit<ExtractionRecord, 'seq'> {
    return {
      assertion: AssertionName.Extract,
      description,
      type: 'number',
      mode: ExtractModeName.Lenient,
      value: 2,
      reasoning: 'names two apples',
      response: 'the response',
      facts: [],
    };
  }
}

export { StateHarness };
