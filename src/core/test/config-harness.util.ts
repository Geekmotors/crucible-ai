import { expect } from '@jest/globals';
import { CrucibleError } from '../errors.js';
import { ConfigStore } from '../config.js';
import { Capture } from './capture.util.js';
import { RunOptionsResolver } from '../run-options-resolver.util.js';
import { FakeConfigBoundary } from './config-boundary.fake.js';
import { ConfigFileName } from './config-file-name.enum.js';
import { ProviderRegistry } from '../../providers/registry.js';
import { FakeAdapter } from '../../providers/test/adapter.fake.js';
import { FakeEnvironment } from '../../providers/test/environment.fake.js';
import { FakeFetchBoundary } from '../../providers/test/fetch-boundary.fake.js';
import { FakeProviderFactory } from '../../providers/test/provider-factory.fake.js';
import { FakeWarningSink } from '../../providers/test/warning-sink.fake.js';

class ConfigHarness {
  static fakeAdapter = new FakeAdapter('fake');

  static registryWithFake(): ProviderRegistry {
    const registry = new ProviderRegistry();
    registry.register(new FakeProviderFactory('fake', undefined, ConfigHarness.fakeAdapter));
    return registry;
  }

  static store(configValue: unknown, verbosityOverride?: string): ConfigStore {
    const raw = typeof configValue === 'string' ? configValue : JSON.stringify(configValue);
    return new ConfigStore(
      new FakeConfigBoundary({ [ConfigFileName.Json]: { found: true, raw } }, verbosityOverride),
      ConfigHarness.registryWithFake(),
    );
  }

  static builtInStore(
    configValue: unknown,
    boundary: FakeFetchBoundary = FakeFetchBoundary.respondingWith(200, {}),
    environment: FakeEnvironment = new FakeEnvironment(),
  ): ConfigStore {
    return new ConfigStore(
      new FakeConfigBoundary({
        [ConfigFileName.Json]: { found: true, raw: JSON.stringify(configValue) },
      }),
      ProviderRegistry.builtIn(boundary.fetchLike, environment.read, new FakeWarningSink().write),
    );
  }

  static builtInJsoncStore(
    raw: string,
    boundary: FakeFetchBoundary,
    environment: FakeEnvironment,
  ): ConfigStore {
    return new ConfigStore(
      new FakeConfigBoundary({ [ConfigFileName.Jsonc]: { found: true, raw } }),
      ProviderRegistry.builtIn(boundary.fetchLike, environment.read, new FakeWarningSink().write),
    );
  }

  static resolvedSettings(store: ConfigStore): Record<string, unknown> {
    const config = store.get();
    return {
      model: config.model,
      meta: { ...config.meta },
      verbosity: config.effectiveVerbosity,
      excerptChars: config.excerptChars,
      runOptions: new RunOptionsResolver().resolve({}, config.testDefaults),
    };
  }

  static errorKind(store: ConfigStore): string {
    const error = Capture.thrown(() => store.get());
    expect(error).toBeInstanceOf(CrucibleError);
    return (error as CrucibleError).kind;
  }
}

export { ConfigHarness };
