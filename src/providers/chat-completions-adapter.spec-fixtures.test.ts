import { describe, expect, it } from '@jest/globals';
import { FixtureOutcome } from '../core/test/fixture-outcome.util.js';
import { SpecFixtures } from '../core/test/spec-fixtures.util.js';
import { ProviderFixtureHarness } from './test/provider-fixture-harness.util.js';

describe('spec provider/request', () => {
  it.each([
    ...SpecFixtures.providerRequest.cases,
    ...SpecFixtures.providerRequestConformance.cases,
  ])('$id', async (fixture) => {
    await expect(
      ProviderFixtureHarness.request(fixture.input, FixtureOutcome.concealedBy(fixture.expect)),
    ).resolves.toEqual(fixture.expect);
  });
});

describe('spec provider/response', () => {
  it.each(SpecFixtures.providerResponse.cases)('$id', async (fixture) => {
    await expect(ProviderFixtureHarness.response(fixture.input)).resolves.toEqual(fixture.expect);
  });
});
