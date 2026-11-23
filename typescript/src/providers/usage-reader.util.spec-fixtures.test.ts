import { describe, expect, it } from '@jest/globals';
import { SpecFixtures } from '../core/test/spec-fixtures.util.js';
import { UsageFixtureHarness } from './test/usage-fixture-harness.util.js';

describe('spec provider/usage', () => {
  it.each(SpecFixtures.providerUsage.cases)('$id', async (fixture) => {
    await expect(UsageFixtureHarness.read(fixture.input)).resolves.toEqual(fixture.expect);
  });
});
