import schema from '../../../spec/fixture.schema.json' with { type: 'json' };
import coherent from '../../../spec/payload/coherent.json' with { type: 'json' };
import coherentConformance from '../../../spec/payload/coherent-conformance.json' with { type: 'json' };
import extract from '../../../spec/payload/extract.json' with { type: 'json' };
import extractConformance from '../../../spec/payload/extract-conformance.json' with { type: 'json' };
import render from '../../../spec/report/render.json' with { type: 'json' };
import trace from '../../../spec/report/trace.json' with { type: 'json' };
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
  static coherent: FixtureFile = coherent;
  static coherentConformance: FixtureFile = coherentConformance;
  static extract: FixtureFile = extract;
  static extractConformance: FixtureFile = extractConformance;
  static render: FixtureFile = render;
  static trace: FixtureFile = trace;

  static files(): FixtureFile[] {
    return [
      SpecFixtures.resolve,
      SpecFixtures.validate,
      SpecFixtures.compute,
      SpecFixtures.coherent,
      SpecFixtures.coherentConformance,
      SpecFixtures.extract,
      SpecFixtures.extractConformance,
      SpecFixtures.render,
      SpecFixtures.trace,
    ];
  }
}

export { SpecFixtures };
export type { FixtureCase, FixtureFile };
