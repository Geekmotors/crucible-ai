import { runScope } from '../../core/state.js';
import { Capture } from '../../core/test/capture.util.js';
import { crucible } from '../crucible.js';
import { FactAdder } from './fact-adder.enum.js';
import { RunFact } from './run-fact.enum.js';

class RunFactsHarness {
  private static NOT_A_FACT = 42;

  static addedBy(adder: FactAdder): readonly string[] {
    return runScope.enterRun(() => {
      crucible[adder](RunFact.Plan);
      crucible[adder]([RunFact.Export, RunFact.Declined]);
      return [...runScope.context().state];
    });
  }

  static mixed(): readonly string[] {
    return runScope.enterRun(() => {
      crucible.load(RunFact.Plan);
      crucible.facts(RunFact.Export);
      crucible.append(RunFact.Declined);
      return [...runScope.context().state];
    });
  }

  static invalid(adder: FactAdder): unknown {
    return runScope.enterRun(() =>
      Capture.thrown(() => crucible[adder](RunFactsHarness.NOT_A_FACT as unknown as string)),
    );
  }
}

export { RunFactsHarness };
