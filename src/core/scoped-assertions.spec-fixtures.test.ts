import { describe, expect, it } from '@jest/globals';
import { AssertionCallFixtureHarness } from './test/assertion-call-fixture-harness.util.js';
import { SpecFixtures } from './test/spec-fixtures.util.js';

describe('spec assertion/call', () => {
  it.each(SpecFixtures.assertionCall.cases)('$id', async (fixture) => {
    await expect(AssertionCallFixtureHarness.call(fixture.input)).resolves.toEqual(fixture.expect);
  });
});
