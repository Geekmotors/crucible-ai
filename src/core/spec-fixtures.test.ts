import { describe, expect, it } from '@jest/globals';
import { ConformanceGoldens } from './test/conformance-goldens.util.js';
import { MalformedFixture } from './test/malformed-fixture.util.js';
import { SchemaCheck } from './test/schema-check.util.js';
import { SpecFixtures } from './test/spec-fixtures.util.js';

describe('spec fixture files', () => {
  const schema = new SchemaCheck(SpecFixtures.schema);

  it.each(SpecFixtures.files())('$area/$operation follows spec/fixture.schema.json', (file) => {
    expect(schema.violations(file)).toEqual([]);
  });

  it('gives every case an id no other case in the spec uses', () => {
    const ids = SpecFixtures.files().flatMap((file) => file.cases.map((fixture) => fixture.id));
    expect(ids.filter((id, index) => ids.indexOf(id) !== index)).toEqual([]);
  });

  it.each(SpecFixtures.files())(
    'prefixes every $area/$operation id with its area and operation',
    (file) => {
      const prefix = `${file.area}-${file.operation}-`;
      expect(file.cases.filter((fixture) => !fixture.id.startsWith(prefix))).toEqual([]);
    },
  );

  it('holds a golden payload for exactly the current conformance cases, built from their inputs', () => {
    expect(ConformanceGoldens.drift()).toEqual([]);
  });

  it.each(MalformedFixture.all())('the schema refuses a fixture with %s', (_label, file) => {
    expect(schema.violations(file)).not.toEqual([]);
  });
});
