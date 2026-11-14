import { describe, expect, it } from '@jest/globals';
import { RunOptionsFixtureHarness } from './test/run-options-fixture-harness.util.js';
import { SpecFixtures } from './test/spec-fixtures.util.js';
import { SpecialValue } from './test/special-value.util.js';

describe('spec run-options/resolve', () => {
  it.each(SpecFixtures.resolve.cases)('$id', async (fixture) => {
    await expect(RunOptionsFixtureHarness.resolve(fixture.input)).resolves.toEqual(
      SpecialValue.decode(fixture.expect),
    );
  });
});

describe('spec run-options/validate', () => {
  it.each(SpecFixtures.validate.cases)('$id', async (fixture) => {
    await expect(RunOptionsFixtureHarness.validate(fixture.input)).resolves.toEqual(
      SpecialValue.decode(fixture.expect),
    );
  });
});
