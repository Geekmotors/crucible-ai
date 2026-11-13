import { expect } from '@jest/globals';
import { CrucibleError } from '../errors.js';
import { ConfigStore } from '../config.js';
import { Capture } from './capture.util.js';
import { FakeConfigBoundary } from './config-boundary.fake.js';
import { ProviderRegistry } from '../../providers/registry.js';
import { FakeAdapter } from '../../providers/test/adapter.fake.js';
import { FakeEnvironment } from '../../providers/test/environment.fake.js';
import { FakeFetchBoundary } from '../../providers/test/fetch-boundary.fake.js';
import { FakeProviderFactory } from '../../providers/test/provider-factory.fake.js';

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
      new FakeConfigBoundary({ found: true, raw }, verbosityOverride),
      ConfigHarness.registryWithFake(),
    );
  }

  static builtInStore(
    configValue: unknown,
    boundary: FakeFetchBoundary = FakeFetchBoundary.respondingWith(200, {}),
    environment: FakeEnvironment = new FakeEnvironment(),
  ): ConfigStore {
    return new ConfigStore(
      new FakeConfigBoundary({ found: true, raw: JSON.stringify(configValue) }),
      ProviderRegistry.builtIn(boundary.fetchLike, environment.read),
    );
  }

  static errorKind(store: ConfigStore): string {
    const error = Capture.thrown(() => store.get());
    expect(error).toBeInstanceOf(CrucibleError);
    return (error as CrucibleError).kind;
  }

  static revealsInError(store: ConfigStore, secret: string): boolean {
    const error = Capture.thrown(() => store.get());
    expect(error).toBeInstanceOf(CrucibleError);
    return (error as CrucibleError).message.includes(secret);
  }
}

export { ConfigHarness };
