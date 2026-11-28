import { describe, expect, it } from '@jest/globals';
import { MeasureFixtureHarness } from './test/measure-fixture-harness.util.js';
import { SpecFixtures } from './test/spec-fixtures.util.js';

describe('spec verdict/measure', () => {
  it.each(SpecFixtures.measure.cases)('$id', async (fixture) => {
    await expect(MeasureFixtureHarness.measure(fixture.input)).resolves.toEqual(fixture.expect);
  });
});

describe('spec verdict/by-assertion', () => {
  it.each(SpecFixtures.byAssertion.cases)('$id', async (fixture) => {
    await expect(MeasureFixtureHarness.byAssertion(fixture.input)).resolves.toEqual(fixture.expect);
  });
});
