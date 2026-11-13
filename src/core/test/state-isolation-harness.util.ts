import type { RunScope } from '../state.js';
import { StartGate } from './start-gate.util.js';

class StateIsolationHarness {
  static facts(runs: number): string[] {
    return Array.from({ length: runs }, (_unused, index) => `run ${index} fact`);
  }

  static interleave<T>(
    scope: RunScope,
    facts: string[],
    act: (fact: string, index: number) => Promise<T>,
  ): Promise<T[]> {
    const gate = new StartGate(facts.length);
    return Promise.all(
      facts.map((fact, index) =>
        scope.enterRun(async () => {
          scope.appendState(fact);
          await gate.arrive();
          return act(fact, index);
        }),
      ),
    );
  }
}

export { StateIsolationHarness };
