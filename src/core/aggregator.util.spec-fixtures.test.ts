import { describe, expect, it } from '@jest/globals';
import { SpecFixtures } from './test/spec-fixtures.util.js';
import { SpecialValue } from './test/special-value.util.js';
import { VerdictFixtureHarness } from './test/verdict-fixture-harness.util.js';

describe('spec verdict/compute', () => {
  it.each(SpecFixtures.compute.cases)('$id', async (fixture) => {
    await expect(VerdictFixtureHarness.compute(fixture.input)).resolves.toEqual(
      SpecialValue.decode(fixture.expect),
    );
  });
});
