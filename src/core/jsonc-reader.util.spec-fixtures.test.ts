import { describe, expect, it } from '@jest/globals';
import { JsoncFixtureHarness } from './test/jsonc-fixture-harness.util.js';
import { SpecFixtures } from './test/spec-fixtures.util.js';

describe('spec jsonc/parse', () => {
  it.each(SpecFixtures.jsoncParse.cases)('$id', async (fixture) => {
    await expect(JsoncFixtureHarness.parse(fixture.input)).resolves.toEqual(fixture.expect);
  });
});
