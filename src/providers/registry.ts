import { CrucibleError } from '../core/errors.js';
import { OpenAiCompatibleProvider } from './openai-compatible.js';
import { OpenAiProvider } from './openai.js';
import { OpenRouterProvider } from './openrouter.js';
import type { EnvReader, FetchLike } from './provider-boundary.js';
import type {
  ProviderAdapter,
  ProviderFactory,
  ProviderSettingName,
  ProviderSettings,
} from './types.js';

class ProviderRegistry {
  private readonly factories = new Map<string, ProviderFactory>();

  private static readProcessEnv(name: string): string | undefined {
    return process.env[name];
  }

  static builtIn(
    fetchLike: FetchLike = globalThis.fetch,
    readEnv: EnvReader = ProviderRegistry.readProcessEnv,
  ): ProviderRegistry {
    const registry = new ProviderRegistry();
    registry.register(new OpenRouterProvider(fetchLike, readEnv));
    registry.register(new OpenAiProvider(fetchLike, readEnv));
    registry.register(new OpenAiCompatibleProvider(fetchLike, readEnv));
    return registry;
  }

  register(factory: ProviderFactory): void {
    if (this.factories.has(factory.name)) {
      throw new CrucibleError('usage', `Provider "${factory.name}" is already registered.`);
    }
    this.factories.set(factory.name, factory);
  }

  create(name: string, settings: ProviderSettings): ProviderAdapter {
    const factory = this.factories.get(name);
    if (factory === undefined) {
      throw new CrucibleError('config', `Unknown provider "${name}". ${this.describeRegistered()}`);
    }
    this.checkSettings(factory, settings);
    return factory.create(settings);
  }

  tryCreate(name: string, settings: ProviderSettings): ProviderAdapter | undefined {
    try {
      return this.create(name, settings);
    } catch {
      return undefined;
    }
  }

  private checkSettings(factory: ProviderFactory, settings: ProviderSettings): void {
    for (const [setting, use] of Object.entries(factory.settingUses)) {
      const given = settings[setting as ProviderSettingName] !== undefined;
      if (given && use === 'unsupported') {
        throw new CrucibleError(
          'config',
          `Provider "${factory.name}" does not take "${setting}". ${this.describeTakers(setting)}`,
        );
      }
      if (!given && use === 'required') {
        throw new CrucibleError('config', `Provider "${factory.name}" needs "${setting}".`);
      }
    }
  }

  private describeTakers(setting: string): string {
    const takers = [...this.factories.values()]
      .filter((factory) => factory.settingUses[setting as ProviderSettingName] !== 'unsupported')
      .map((factory) => factory.name);
    return takers.length > 0 ? `Providers that take it: ${takers.join(', ')}.` : '';
  }

  private describeRegistered(): string {
    const names = [...this.factories.keys()];
    return names.length > 0
      ? `Registered providers: ${names.join(', ')}.`
      : 'No providers are registered.';
  }
}

const providerRegistry = ProviderRegistry.builtIn();

export { ProviderRegistry, providerRegistry };
