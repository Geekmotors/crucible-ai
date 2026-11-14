import { isDeepStrictEqual } from 'node:util';
import { PublicSurface } from './public-surface.util.js';
import type { SchemaField } from './public-surface.util.js';
import { SpecFixtures } from './spec-fixtures.util.js';

type SurfaceItem = {
  name?: string;
  kind?: string;
  assertion?: string;
  retryable?: boolean;
  operation?: string;
  text?: string;
  required?: boolean;
  default?: unknown;
  values?: unknown[];
  fixtures: string[];
};

type SurfaceManifest = {
  operations: { name: string }[];
  functions: SurfaceItem[];
  runOptions: SurfaceItem[];
  callOptions: SurfaceItem[];
  configFields: SurfaceItem[];
  providers: SurfaceItem[];
  environment: SurfaceItem[];
  errorKinds: SurfaceItem[];
  verdictOutcomes: SurfaceItem[];
  reportText: SurfaceItem[];
};

type Section = Exclude<keyof SurfaceManifest, 'operations'>;

type CitedCase = { operation: string; input: unknown; expect: unknown };

type CallInput = { assertion?: unknown; args?: unknown[] };

type Exercise = (item: SurfaceItem, cited: CitedCase) => boolean;

class SurfaceCheck {
  private static sections: Section[] = [
    'functions',
    'runOptions',
    'callOptions',
    'configFields',
    'providers',
    'environment',
    'errorKinds',
    'verdictOutcomes',
    'reportText',
  ];

  private static exercises: Record<Section, Exercise> = {
    functions: () => true,
    runOptions: (item, cited) => SurfaceCheck.mentions(cited.input, item.name),
    callOptions: (item, cited) => SurfaceCheck.setsCallOption(item, cited),
    configFields: (item, cited) => SurfaceCheck.mentions(cited.input, item.name),
    providers: (item, cited) => SurfaceCheck.mentions(cited.input, item.name),
    environment: (item, cited) => SurfaceCheck.mentions(cited.input, item.name),
    errorKinds: (item, cited) => SurfaceCheck.failsAs(item, cited.expect),
    verdictOutcomes: (item, cited) =>
      cited.operation === 'verdict/compute' &&
      (cited.expect as { value?: { outcome?: unknown } }).value?.outcome === item.name,
    reportText: (item, cited) =>
      cited.operation === item.operation &&
      typeof (cited.expect as { text?: unknown }).text === 'string' &&
      (cited.expect as { text: string }).text.includes(item.text ?? ''),
  };

  private cases: Map<string, CitedCase>;

  constructor(private manifest: SurfaceManifest) {
    this.cases = new Map(
      SpecFixtures.files().flatMap((file) =>
        file.cases.map((fixture) => [
          fixture.id,
          {
            operation: `${file.area}/${file.operation}`,
            input: fixture.input,
            expect: fixture.expect,
          },
        ]),
      ),
    );
  }

  uncited(): string[] {
    return this.items()
      .filter(([, item]) => item.fixtures.length === 0)
      .map(([section, item]) => `${section} ${SurfaceCheck.label(item)}: no fixture`);
  }

  unknownCases(): string[] {
    return this.items().flatMap(([section, item]) =>
      item.fixtures
        .filter((id) => !this.cases.has(id))
        .map((id) => `${section} ${SurfaceCheck.label(item)}: no case ${id}`),
    );
  }

  unexercised(): string[] {
    return this.items().flatMap(([section, item]) =>
      item.fixtures
        .filter((id) => {
          const cited = this.cases.get(id);
          return cited !== undefined && !SurfaceCheck.exercises[section](item, cited);
        })
        .map((id) => `${section} ${SurfaceCheck.label(item)}: ${id} does not exercise it`),
    );
  }

  operationDrift(): string[] {
    const spec = [...new Set([...this.cases.values()].map((cited) => cited.operation))];
    return SurfaceCheck.drift(
      'operations',
      this.manifest.operations.map((operation) => operation.name),
      spec,
    );
  }

  surfaceDrift(): string[] {
    const testDefaults = PublicSurface.testDefaults();
    const configFields = PublicSurface.configFields();
    return [
      ...SurfaceCheck.drift('functions', this.names('functions'), PublicSurface.functionNames()),
      ...SurfaceCheck.drift(
        'runOptions',
        this.names('runOptions'),
        Object.keys(PublicSurface.runOptions),
      ),
      ...SurfaceCheck.drift('runOptions', this.names('runOptions'), Object.keys(testDefaults)),
      ...SurfaceCheck.disagreements('runOptions', this.manifest.runOptions, testDefaults),
      ...SurfaceCheck.drift('callOptions', this.callOptionNames(), [
        ...Object.keys(PublicSurface.coherentOptions).map((name) => `coherent.${name}`),
        ...Object.keys(PublicSurface.extractOptions).map((name) => `extract.${name}`),
      ]),
      ...SurfaceCheck.drift(
        'extract.as values',
        this.extractTypes(),
        Object.keys(PublicSurface.extractTypes),
      ),
      ...SurfaceCheck.drift('configFields', this.names('configFields'), Object.keys(configFields)),
      ...SurfaceCheck.disagreements('configFields', this.manifest.configFields, configFields),
      ...this.requiredDrift(),
      ...SurfaceCheck.drift(
        'providers',
        this.names('providers'),
        PublicSurface.providers().map(String),
      ),
      ...SurfaceCheck.drift(
        'errorKinds',
        this.manifest.errorKinds.map((item) => SurfaceCheck.label(item)),
        PublicSurface.errorKindLabels(),
      ),
      ...SurfaceCheck.missing(
        'verdictOutcomes',
        this.names('verdictOutcomes'),
        Object.keys(PublicSurface.verdictOutcomes),
      ),
      ...SurfaceCheck.missing('environment', this.names('environment'), [
        String(PublicSurface.defaultKeyVariable()),
      ]),
    ];
  }

  private items(): [Section, SurfaceItem][] {
    return SurfaceCheck.sections.flatMap((section) =>
      this.manifest[section].map((item): [Section, SurfaceItem] => [section, item]),
    );
  }

  private names(section: Section): string[] {
    return this.manifest[section].map((item) => item.name ?? '');
  }

  private callOptionNames(): string[] {
    return this.manifest.callOptions.map((item) => `${item.assertion ?? ''}.${item.name ?? ''}`);
  }

  private extractTypes(): string[] {
    const as = this.manifest.callOptions.find(
      (item) => item.assertion === 'extract' && item.name === 'as',
    );
    return (as?.values ?? []).map(String);
  }

  private requiredDrift(): string[] {
    const required = this.manifest.configFields
      .filter((item) => item.required === true)
      .map((item) => item.name ?? '');
    return SurfaceCheck.drift('required configFields', required, PublicSurface.config.required);
  }

  private static disagreements(
    section: Section,
    items: SurfaceItem[],
    schema: Record<string, SchemaField>,
  ): string[] {
    return items.flatMap((item) => {
      const field = schema[item.name ?? ''];
      if (field === undefined) {
        return [];
      }
      const wrongDefault =
        field.default !== undefined && !isDeepStrictEqual(field.default, item.default);
      const wrongValues = field.enum !== undefined && !isDeepStrictEqual(field.enum, item.values);
      return [
        ...(wrongDefault
          ? [`${section} ${item.name}: default differs from the config schema`]
          : []),
        ...(wrongValues ? [`${section} ${item.name}: values differ from the config schema`] : []),
      ];
    });
  }

  private static drift(section: string, listed: string[], actual: string[]): string[] {
    return [
      ...SurfaceCheck.missing(section, listed, actual),
      ...listed
        .filter((name, index) => listed.indexOf(name) !== index)
        .map((name) => `${section} ${name}: listed twice`),
      ...listed
        .filter((name) => !actual.includes(name))
        .map((name) => `${section} ${name}: not in the TypeScript surface or spec`),
    ];
  }

  private static missing(section: string, listed: string[], actual: string[]): string[] {
    return actual
      .filter((name) => !listed.includes(name))
      .map((name) => `${section} ${name}: missing from spec/surface.json`);
  }

  private static setsCallOption(item: SurfaceItem, cited: CitedCase): boolean {
    if (cited.operation !== 'assertion/call') {
      return SurfaceCheck.mentions(cited.input, item.name);
    }
    const input = cited.input as CallInput;
    return input.assertion === item.assertion && SurfaceCheck.mentions(input.args?.[2], item.name);
  }

  private static failsAs(item: SurfaceItem, expected: unknown): boolean {
    const error = (expected as { error?: { kind?: unknown; retryable?: unknown } }).error;
    return error?.kind === item.kind && error?.retryable === item.retryable;
  }

  private static mentions(value: unknown, name: string | undefined): boolean {
    if (name === undefined) {
      return false;
    }
    if (typeof value === 'string') {
      return value === name || value.includes(`"${name}"`);
    }
    if (Array.isArray(value)) {
      return value.some((entry) => SurfaceCheck.mentions(entry, name));
    }
    if (typeof value === 'object' && value !== null) {
      return Object.entries(value).some(
        ([key, entry]) => key === name || SurfaceCheck.mentions(entry, name),
      );
    }
    return false;
  }

  private static label(item: SurfaceItem): string {
    const name = item.name ?? item.kind ?? '';
    const qualified = item.assertion === undefined ? name : `${item.assertion}.${name}`;
    return item.retryable === undefined ? qualified : `${qualified} retryable ${item.retryable}`;
  }
}

export { SurfaceCheck };
export type { SurfaceItem, SurfaceManifest };
