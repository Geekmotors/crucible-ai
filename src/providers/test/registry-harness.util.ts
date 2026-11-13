import { expect } from '@jest/globals';
import { CrucibleError } from '../../core/errors.js';
import { Capture } from '../../core/test/capture.util.js';
import { ProviderRegistry } from '../registry.js';
import type { FakeEnvironment } from './environment.fake.js';
import type { FakeFetchBoundary } from './fetch-boundary.fake.js';
import { FakeWarningSink } from './warning-sink.fake.js';

class RegistryHarness {
  static builtIn(boundary: FakeFetchBoundary, environment: FakeEnvironment): ProviderRegistry {
    return ProviderRegistry.builtIn(
      boundary.fetchLike,
      environment.read,
      new FakeWarningSink().write,
    );
  }

  static errorKind(fn: () => unknown): string {
    const error = Capture.thrown(fn);
    expect(error).toBeInstanceOf(CrucibleError);
    return (error as CrucibleError).kind;
  }
}

export { RegistryHarness };
