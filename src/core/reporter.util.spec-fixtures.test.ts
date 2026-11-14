import { describe, expect, it } from '@jest/globals';
import { ReportFixtureHarness } from './test/report-fixture-harness.util.js';
import { SpecFixtures } from './test/spec-fixtures.util.js';

describe('spec report/render', () => {
  it.each(SpecFixtures.render.cases)('$id', async (fixture) => {
    await expect(ReportFixtureHarness.render(fixture.input)).resolves.toEqual(fixture.expect);
  });
});
