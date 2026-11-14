import { expect } from '@jest/globals';
import { crucible } from 'crucible';
import scenario from './fixtures/runner-variants.json' with { type: 'json' };

const options = { runs: scenario.runs, threshold: scenario.threshold };
const rows = scenario.rows.table as [string, number][];
const groups = scenario.groups.table as [string, string, string, string][];

crucible.it.each(rows)(
  scenario.rows.name,
  options,
  async (t, reply, count) => {
    expect(await t.extract(reply, scenario.rows.target, { as: 'number' })).toBe(count);
  },
  scenario.timeout,
);

crucible.describe.each(groups)(scenario.groups.name, options, (_label, fact, reply, claim) => {
  crucible.it(
    scenario.groups.test,
    async (t) => {
      t.facts(fact);
      expect(await t.coherent(reply, claim)).toBe(true);
    },
    scenario.timeout,
  );
});

crucible.it.skip(scenario.skipped, options, async () => {
  throw new Error('a skipped test body must never run');
});

crucible.it.todo(scenario.planned);
