import { describe, expect, it } from '@jest/globals';
import { ConfigFixtureHarness } from './test/config-fixture-harness.util.js';
import { FixtureOutcome } from './test/fixture-outcome.util.js';
import { SpecFixtures } from './test/spec-fixtures.util.js';

describe('spec config/load', () => {
  it.each(SpecFixtures.configLoad.cases)('$id', async (fixture) => {
    await expect(
      ConfigFixtureHarness.load(fixture.input, FixtureOutcome.concealedBy(fixture.expect)),
    ).resolves.toEqual(fixture.expect);
  });
});
