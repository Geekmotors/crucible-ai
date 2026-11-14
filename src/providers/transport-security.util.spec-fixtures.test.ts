import { describe, expect, it } from '@jest/globals';
import { SpecFixtures } from '../core/test/spec-fixtures.util.js';
import { ProviderFixtureHarness } from './test/provider-fixture-harness.util.js';

describe('spec provider/plain-http-warning', () => {
  it.each(SpecFixtures.providerPlainHttpWarning.cases)('$id', async (fixture) => {
    await expect(ProviderFixtureHarness.plainHttpWarning(fixture.input)).resolves.toEqual(
      fixture.expect,
    );
  });
});
