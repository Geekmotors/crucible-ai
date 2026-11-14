import schema from '../../../spec/fixture.schema.json' with { type: 'json' };
import coherent from '../../../spec/payload/coherent.json' with { type: 'json' };
import coherentConformance from '../../../spec/payload/coherent-conformance.json' with { type: 'json' };
import extract from '../../../spec/payload/extract.json' with { type: 'json' };
import providerPlainHttpWarning from '../../../spec/provider/plain-http-warning.json' with { type: 'json' };
import providerRequest from '../../../spec/provider/request.json' with { type: 'json' };
import providerRequestConformance from '../../../spec/provider/request-conformance.json' with { type: 'json' };
import providerResponse from '../../../spec/provider/response.json' with { type: 'json' };
import extractConformance from '../../../spec/payload/extract-conformance.json' with { type: 'json' };
import render from '../../../spec/report/render.json' with { type: 'json' };
import trace from '../../../spec/report/trace.json' with { type: 'json' };
import resolve from '../../../spec/run-options/resolve.json' with { type: 'json' };
import validate from '../../../spec/run-options/validate.json' with { type: 'json' };
import compute from '../../../spec/verdict/compute.json' with { type: 'json' };
import configLoad from '../../../spec/config/load.json' with { type: 'json' };
import judgeReply from '../../../spec/judge/reply.json' with { type: 'json' };
import jsoncParse from '../../../spec/jsonc/parse.json' with { type: 'json' };

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
  static jsoncParse: FixtureFile = jsoncParse;
  static configLoad: FixtureFile = configLoad;
  static providerRequest: FixtureFile = providerRequest;
  static providerRequestConformance: FixtureFile = providerRequestConformance;
  static providerResponse: FixtureFile = providerResponse;
  static providerPlainHttpWarning: FixtureFile = providerPlainHttpWarning;
  static judgeReply: FixtureFile = judgeReply;

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
      SpecFixtures.jsoncParse,
      SpecFixtures.configLoad,
      SpecFixtures.providerRequest,
      SpecFixtures.providerRequestConformance,
      SpecFixtures.providerResponse,
      SpecFixtures.providerPlainHttpWarning,
      SpecFixtures.judgeReply,
    ];
  }
}

export { SpecFixtures };
export type { FixtureCase, FixtureFile };
