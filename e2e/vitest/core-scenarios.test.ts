import { afterAll, describe, expect, test } from 'vitest';
import { crucible } from 'crucible/vitest';
import type { RunContext } from 'crucible/vitest';
import scenario from './fixtures/core-scenarios.json' with { type: 'json' };

const options = { runs: scenario.runs, threshold: scenario.threshold };
const rows = scenario.rows.table as [string, number][];

crucible.it(
  scenario.single.name,
  options,
  async (t) => {
    t.facts(scenario.single.facts);
    expect(await t.coherent(scenario.single.response, scenario.single.claim)).toBe(true);
  },
  scenario.timeout,
);

crucible.it.each(rows)(
  scenario.rows.name,
  options,
  async (t, reply, count) => {
    expect(await t.extract(reply, scenario.rows.target, { as: 'number' })).toBe(count);
  },
  scenario.timeout,
);

describe(scenario.group.around, () => {
  let probeRuns = 0;
  let groupRuns = 0;

  crucible.describe(scenario.group.name, options, () => {
    crucible.it(scenario.group.probe, () => {
      probeRuns += 1;
    });
    crucible.it(
      scenario.group.test,
      async (t) => {
        groupRuns += 1;
        expect(probeRuns).toBe(scenario.runs);
        t.facts(scenario.group.facts);
        expect(await t.coherent(scenario.group.response, scenario.group.claim)).toBe(true);
      },
      scenario.timeout,
    );
  });

  afterAll(() => {
    expect(groupRuns).toBe(scenario.runs);
  });
});

test(
  scenario.gate.name,
  crucible.gate(options, async (t: RunContext) => {
    t.facts(scenario.gate.facts);
    expect(await t.coherent(scenario.gate.response, scenario.gate.claim)).toBe(true);
  }),
  scenario.timeout,
);
