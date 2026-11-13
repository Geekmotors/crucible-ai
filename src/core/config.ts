import { CrucibleError } from './errors.js';
import type { CrucibleErrorKind } from './errors.js';
import { CONFIG_FILE_NAME } from './config-boundary.js';
import type { ConfigBoundary, ConfigFileRead } from './config-boundary.js';
import { FileSystemConfigBoundary } from './file-system-config-boundary.js';
import { DEFAULT_REPORT_SETTINGS } from './report-settings.js';
import { RunOptionsValidator } from './run-options-validator.util.js';
import type { RunOptions } from './run-options.js';
import { VERBOSITY_LEVELS } from './verbosity.js';
import type { Verbosity } from './verbosity.js';
import { providerRegistry, ProviderRegistry } from '../providers/registry.js';
import type { ProviderAdapter, ProviderSettings } from '../providers/types.js';

const KNOWN_FIELDS = [
  'provider',
  'model',
  'meta',
  'verbosity',
  'testDefaults',
  'excerptChars',
  'baseUrl',
  'apiKeyEnv',
] as const;
const KEY_LIKE_FIELDS = ['apikey', 'api_key', 'key', 'token', 'secret', 'authorization'] as const;
const WEB_PROTOCOLS = ['http:', 'https:'] as const;
const ENV_VAR_NAME = /^[A-Za-z_][A-Za-z0-9_]*$/;

type CrucibleConfig = {
  readonly provider: ProviderAdapter;
  readonly model: string;
  readonly meta?: Readonly<Record<string, unknown>>;
  readonly effectiveVerbosity: Verbosity;
  readonly testDefaults: RunOptions;
  readonly excerptChars: number;
};

class ConfigStore {
  private cached?: CrucibleConfig;
  private readonly validator = new RunOptionsValidator();

  constructor(
    private readonly boundary: ConfigBoundary,
    private readonly registry: ProviderRegistry,
  ) {}

  get(): CrucibleConfig {
    this.cached ??= this.load();
    return this.cached;
  }

  private load(): CrucibleConfig {
    const root = this.parseRoot(this.readRaw());
    this.rejectKeyLikeFields(root);
    this.rejectUnknownFields(root);
    return Object.freeze({
      provider: this.registry.create(
        this.requireName(root.provider, 'provider'),
        this.requireProviderSettings(root),
      ),
      model: this.requireName(root.model, 'model'),
      meta: this.requireMetaShape(root.meta),
      effectiveVerbosity: this.resolveEffectiveVerbosity(root.verbosity),
      testDefaults: this.requireTestDefaults(root.testDefaults),
      excerptChars: this.requireExcerptChars(root.excerptChars),
    });
  }

  private readRaw(): string {
    const read = this.boundary.readConfigFile();
    if (read.found) {
      return read.raw;
    }
    const source = this.boundary.describeSource();
    if (read.reason === 'missing') {
      throw this.failure(
        `Could not find ${source}. Create a ${CONFIG_FILE_NAME} at your project root ` +
          `with at least { "provider": "...", "model": "..." }.`,
      );
    }
    throw this.failure(`Could not read ${source} (${read.detail ?? 'unknown cause'}).`);
  }

  private parseRoot(raw: string): Record<string, unknown> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.replace(/^\uFEFF/, ''));
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : String(cause);
      throw this.failure(
        `${this.boundary.describeSource()} is not valid JSON (${detail}). Fix the JSON syntax.`,
      );
    }
    if (!this.isPlainObject(parsed)) {
      throw this.failure(
        `${this.boundary.describeSource()} must contain a single JSON object at the root.`,
      );
    }
    return parsed;
  }

  private rejectKeyLikeFields(root: Record<string, unknown>): void {
    const keyLike = new Set<string>(KEY_LIKE_FIELDS);
    const found = Object.keys(root).find((field) => keyLike.has(field.toLowerCase()));
    if (found === undefined) {
      return;
    }
    throw this.failure(
      `${CONFIG_FILE_NAME} must never contain API keys: remove "${found}" and set ` +
        `${this.describeKeyEnvVar(root)} instead.`,
    );
  }

  private describeKeyEnvVar(root: Record<string, unknown>): string {
    const settings = {
      baseUrl: typeof root.baseUrl === 'string' ? root.baseUrl : undefined,
      apiKeyEnv:
        typeof root.apiKeyEnv === 'string' && ENV_VAR_NAME.test(root.apiKeyEnv)
          ? root.apiKeyEnv
          : undefined,
    };
    const envVar =
      typeof root.provider === 'string'
        ? this.registry.tryCreate(root.provider, settings)?.envVar
        : undefined;
    return envVar !== undefined
      ? `the ${envVar} environment variable`
      : 'an environment variable holding the key (named in "apiKeyEnv" where the provider takes it)';
  }

  private requireProviderSettings(root: Record<string, unknown>): ProviderSettings {
    return {
      baseUrl: this.requireBaseUrl(root.baseUrl),
      apiKeyEnv: this.requireApiKeyEnv(root.apiKeyEnv),
    };
  }

  private requireBaseUrl(value: unknown): string | undefined {
    if (value === undefined) {
      return undefined;
    }
    const url = typeof value === 'string' ? this.parsePlainWebUrl(value) : undefined;
    if (url === undefined) {
      throw this.failure(
        `"baseUrl" in ${CONFIG_FILE_NAME} must be an http or https URL without credentials, ` +
          `query or fragment, e.g. "http://localhost:11434/v1".`,
      );
    }
    return url.href.replace(/\/+$/, '');
  }

  private parsePlainWebUrl(value: string): URL | undefined {
    if (/[?#]/.test(value)) {
      return undefined;
    }
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      return undefined;
    }
    const plain =
      (WEB_PROTOCOLS as readonly string[]).includes(url.protocol) &&
      url.username === '' &&
      url.password === '';
    return plain ? url : undefined;
  }

  private requireApiKeyEnv(value: unknown): string | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (typeof value !== 'string' || !ENV_VAR_NAME.test(value)) {
      throw this.failure(
        `"apiKeyEnv" in ${CONFIG_FILE_NAME} must be the name of an environment variable ` +
          `(letters, digits and underscores, not starting with a digit), never the key itself.`,
      );
    }
    return value;
  }

  private rejectUnknownFields(root: Record<string, unknown>): void {
    const known = new Set<string>(KNOWN_FIELDS);
    const unknown = Object.keys(root).find((field) => !known.has(field));
    if (unknown !== undefined) {
      throw this.failure(
        `Unknown field "${unknown}" in ${CONFIG_FILE_NAME}. ` +
          `Allowed fields: ${KNOWN_FIELDS.join(', ')}.`,
      );
    }
  }

  private requireName(value: unknown, field: string): string {
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw this.failure(`"${field}" in ${CONFIG_FILE_NAME} must be a non-empty string.`);
    }
    return value;
  }

  private requireMetaShape(value: unknown): Readonly<Record<string, unknown>> | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (!this.isPlainObject(value)) {
      throw this.failure(`"meta" in ${CONFIG_FILE_NAME} must be an object when present.`);
    }
    return value;
  }

  private requireTestDefaults(value: unknown): RunOptions {
    if (value === undefined) {
      return Object.freeze({});
    }
    const violation = this.validator.violation(value, `"testDefaults" in ${CONFIG_FILE_NAME}`);
    if (violation !== undefined) {
      throw this.failure(violation);
    }
    return Object.freeze({ ...(value as RunOptions) });
  }

  private requireExcerptChars(value: unknown): number {
    if (value === undefined) {
      return DEFAULT_REPORT_SETTINGS.excerptChars;
    }
    if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
      throw this.failure(`"excerptChars" in ${CONFIG_FILE_NAME} must be an integer of at least 1.`);
    }
    return value;
  }

  private resolveEffectiveVerbosity(configured: unknown): Verbosity {
    const fromConfig =
      configured === undefined
        ? 'default'
        : this.requireVerbosity(configured, `"verbosity" in ${CONFIG_FILE_NAME}`, 'config');
    const override = this.boundary.readVerbosityOverride();
    if (override !== undefined && override !== '') {
      return this.requireVerbosity(override, 'the CRUCIBLE_VERBOSE environment variable', 'usage');
    }
    return fromConfig;
  }

  private requireVerbosity(value: unknown, source: string, kind: CrucibleErrorKind): Verbosity {
    if (typeof value === 'string' && (VERBOSITY_LEVELS as readonly string[]).includes(value)) {
      return value as Verbosity;
    }
    throw new CrucibleError(
      kind,
      `Invalid verbosity "${String(value)}" from ${source}. ` +
        `Valid levels: ${VERBOSITY_LEVELS.join(', ')}.`,
    );
  }

  private isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  private failure(message: string): CrucibleError {
    return new CrucibleError('config', message);
  }
}

const config = new ConfigStore(new FileSystemConfigBoundary(), providerRegistry);

export { config, ConfigStore };
export type { ConfigBoundary, ConfigFileRead, CrucibleConfig, Verbosity };
