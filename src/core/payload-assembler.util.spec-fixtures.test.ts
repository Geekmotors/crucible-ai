import { describe, expect, it } from '@jest/globals';
import { PayloadFixtureHarness } from './test/payload-fixture-harness.util.js';
import { SpecFixtures } from './test/spec-fixtures.util.js';

describe('spec payload/coherent', () => {
  it.each([...SpecFixtures.coherent.cases, ...SpecFixtures.coherentConformance.cases])(
    '$id',
    async (fixture) => {
      await expect(PayloadFixtureHarness.coherent(fixture.input)).resolves.toEqual(fixture.expect);
    },
  );
});

describe('spec payload/extract', () => {
  it.each([...SpecFixtures.extract.cases, ...SpecFixtures.extractConformance.cases])(
    '$id',
    async (fixture) => {
      await expect(PayloadFixtureHarness.extract(fixture.input)).resolves.toEqual(fixture.expect);
    },
  );
});
