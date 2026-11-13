import type { ExtractionRecord, VerdictRecord } from '../state.js';
import { AssertionName } from './assertion-name.enum.js';

class StateHarness {
  static verdict(claim: string): Omit<VerdictRecord, 'seq'> {
    return {
      assertion: AssertionName.Coherent,
      claim,
      verdict: true,
      reasoning: 'consistent',
      response: 'the response',
    };
  }

  static extraction(description: string): Omit<ExtractionRecord, 'seq'> {
    return {
      assertion: AssertionName.Extract,
      description,
      type: 'number',
      value: 2,
      reasoning: 'names two apples',
      response: 'the response',
    };
  }
}

export { StateHarness };
