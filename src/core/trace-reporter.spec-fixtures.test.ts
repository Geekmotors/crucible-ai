import { describe, expect, it } from '@jest/globals';
import { SpecFixtures } from './test/spec-fixtures.util.js';
import { TraceFixtureHarness } from './test/trace-fixture-harness.util.js';

describe('spec report/trace', () => {
  it.each(SpecFixtures.trace.cases)('$id', async (fixture) => {
    await expect(TraceFixtureHarness.trace(fixture.input)).resolves.toEqual(fixture.expect);
  });
});
