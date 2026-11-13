import type { ProviderAdapter, ProviderSettings } from '../types.js';
import { OpenAiCompatibleProvider } from '../openai-compatible.js';
import { FakeEnvironment } from './environment.fake.js';
import { FakeFetchBoundary } from './fetch-boundary.fake.js';
import { FakeWarningSink } from './warning-sink.fake.js';

class CompatibleProviderHarness {
  warnings = new FakeWarningSink();
  provider: OpenAiCompatibleProvider;

  constructor(boundary: FakeFetchBoundary, environment: FakeEnvironment = new FakeEnvironment()) {
    this.provider = new OpenAiCompatibleProvider(
      boundary.fetchLike,
      environment.read,
      this.warnings.write,
    );
  }

  create(settings: ProviderSettings): ProviderAdapter {
    return this.provider.create(settings);
  }
}

export { CompatibleProviderHarness };
