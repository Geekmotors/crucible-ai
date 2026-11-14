import configSchema from '../../../schemas/crucible.config.schema.json' with { type: 'json' };
import type { CoherentOptions } from '../../api/coherent-options.js';
import type { CrucibleSurface } from '../../api/crucible-surface.js';
import type { ExtractOptions } from '../../api/extract-options.js';
import type { RunContext } from '../../api/run-context.js';
import type { RunOptions } from '../../api/run-options.js';
import type { CrucibleErrorKind } from '../errors.js';
import type { ExtractType } from '../extract-type.js';
import type { VerdictOutcome } from '../verdict-error.js';

type SchemaField = {
  default?: unknown;
  enum?: unknown[];
  properties?: Record<string, SchemaField>;
};

type ConfigSchema = SchemaField & { required: string[] };

class PublicSurface {
  static crucible: Record<keyof CrucibleSurface, true> = {
    it: true,
    describe: true,
    gate: true,
    coherent: true,
    extract: true,
    facts: true,
    load: true,
    append: true,
  };

  static runContext: Record<keyof RunContext, true> = {
    facts: true,
    coherent: true,
    extract: true,
  };

  static runOptions: Record<keyof RunOptions, true> = {
    runs: true,
    threshold: true,
    inferenceTimeout: true,
    testTimeout: true,
    strict: true,
  };

  static coherentOptions: Record<keyof CoherentOptions, true> = { facts: true };

  static extractOptions: Record<keyof ExtractOptions, true> = {
    as: true,
    strict: true,
    facts: true,
  };

  static extractTypes: Record<ExtractType, true> = { string: true, number: true, boolean: true };

  static errorKinds: Record<CrucibleErrorKind, true> = { usage: true, config: true, infra: true };

  static verdictOutcomes: Record<VerdictOutcome, true> = { failed: true, errored: true };

  static config: ConfigSchema = configSchema as ConfigSchema;

  static functionNames(): string[] {
    return [
      ...Object.keys(PublicSurface.crucible).map((name) => `crucible.${name}`),
      ...Object.keys(PublicSurface.runContext).map((name) => `t.${name}`),
    ];
  }

  static errorKindLabels(): string[] {
    return Object.keys(PublicSurface.errorKinds).flatMap((kind) =>
      kind === 'infra' ? [`${kind} retryable true`, `${kind} retryable false`] : [kind],
    );
  }

  static configFields(): Record<string, SchemaField> {
    return PublicSurface.config.properties ?? {};
  }

  static testDefaults(): Record<string, SchemaField> {
    return PublicSurface.configFields().testDefaults?.properties ?? {};
  }

  static providers(): unknown[] {
    return PublicSurface.configFields().provider?.enum ?? [];
  }

  static defaultKeyVariable(): unknown {
    return PublicSurface.configFields().apiKeyEnv?.default;
  }
}

export { PublicSurface };
export type { SchemaField };
