import schema from '../../../spec/fixture.schema.json' with { type: 'json' };
import resolve from '../../../spec/run-options/resolve.json' with { type: 'json' };
import validate from '../../../spec/run-options/validate.json' with { type: 'json' };
import compute from '../../../spec/verdict/compute.json' with { type: 'json' };

type FixtureCase = {
  id: string;
  description: string;
  input: unknown;
  expect: unknown;
};

type FixtureFile = {
  area: string;
  operation: string;
  description: string;
  cases: FixtureCase[];
};

class SpecFixtures {
  static schema: unknown = schema;
  static resolve: FixtureFile = resolve;
  static validate: FixtureFile = validate;
  static compute: FixtureFile = compute;

  static files(): FixtureFile[] {
    return [SpecFixtures.resolve, SpecFixtures.validate, SpecFixtures.compute];
  }
}

export { SpecFixtures };
export type { FixtureCase, FixtureFile };
