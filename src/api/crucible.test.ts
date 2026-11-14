import { describe, expect, it } from '@jest/globals';
import { CrucibleError } from '../core/errors.js';
import { Capture } from '../core/test/capture.util.js';
import { crucible } from './crucible.js';
import { FactAdder } from './test/fact-adder.enum.js';
import { RunFact } from './test/run-fact.enum.js';
import { RunFactsHarness } from './test/run-facts-harness.util.js';

describe('crucible.facts and its deprecated aliases', () => {
  it('crucible.facts adds one fact or several to the run, in call order', () => {
    expect(RunFactsHarness.addedBy(FactAdder.Facts)).toEqual([
      RunFact.Plan,
      RunFact.Export,
      RunFact.Declined,
    ]);
  });

  it.each([FactAdder.Load, FactAdder.Append])(
    'crucible.%s adds exactly what crucible.facts adds',
    (alias) => {
      expect(RunFactsHarness.addedBy(alias)).toEqual(RunFactsHarness.addedBy(FactAdder.Facts));
    },
  );

  it('facts and the aliases append to one run state', () => {
    expect(RunFactsHarness.mixed()).toEqual([RunFact.Plan, RunFact.Export, RunFact.Declined]);
  });

  it.each([FactAdder.Facts, FactAdder.Load, FactAdder.Append])(
    'crucible.%s rejects a non-string as a usage error',
    (adder) => {
      const error = RunFactsHarness.invalid(adder);
      expect(error).toBeInstanceOf(CrucibleError);
      expect((error as CrucibleError).kind).toBe('usage');
    },
  );

  it('crucible.facts outside a running test is a usage error', () => {
    const error = Capture.thrown(() => crucible.facts(RunFact.Plan));
    expect(error).toBeInstanceOf(CrucibleError);
    expect((error as CrucibleError).kind).toBe('usage');
  });
});
