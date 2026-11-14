import { expect, it } from '@jest/globals';
import { crucible } from 'crucible-ai';
import type { RunContext } from 'crucible-ai';
import scenario from './fixtures/plain-runner-gate.json' with { type: 'json' };

const options = { runs: scenario.runs, threshold: scenario.threshold };
const rows = scenario.rows.table as [string, number][];

it(
  scenario.single.name,
  crucible.gate(options, async (t) => {
    t.facts(scenario.single.facts);
    expect(await t.coherent(scenario.single.response, scenario.single.claim)).toBe(
      scenario.single.expected,
    );
  }),
  scenario.timeout,
);

it.each(rows)(
  scenario.rows.name,
  crucible.gate(options, async (t: RunContext, reply: string, count: number) => {
    expect(await t.extract(reply, scenario.rows.target, { as: 'number' })).toBe(count);
  }),
  scenario.timeout,
);
