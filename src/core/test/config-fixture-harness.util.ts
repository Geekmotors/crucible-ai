import { ConfigStore } from '../config.js';
import type { ConfigFileRead } from '../config.js';
import type { FetchLike } from '../../providers/provider-boundary.js';
import { ProviderRegistry } from '../../providers/registry.js';
import { FakeEnvironment } from '../../providers/test/environment.fake.js';
import { FakeFetchBoundary } from '../../providers/test/fetch-boundary.fake.js';
import { FakeWarningSink } from '../../providers/test/warning-sink.fake.js';
import { FakeConfigBoundary } from './config-boundary.fake.js';
import { FixtureOutcome } from './fixture-outcome.util.js';
import type { ObservedOutcome } from './fixture-outcome.util.js';

type FixtureFile = string | { $special: string };

type LoadInput = {
  files: Record<string, FixtureFile>;
  env?: Record<string, string>;
};

class ConfigFixtureHarness {
  private static VERBOSITY_VARIABLE = 'CRUCIBLE_VERBOSE';
  private static UNREADABLE = 'unreadable';

  static load(input: unknown, concealed: string[]): Promise<ObservedOutcome> {
    const { files, env = {} } = input as LoadInput;
    return FixtureOutcome.settled(() => {
      const config = ConfigFixtureHarness.store(files, env).get();
      return {
        provider: config.provider.name,
        model: config.model,
        meta: config.meta,
        verbosity: config.effectiveVerbosity,
        testDefaults: config.testDefaults,
        excerptChars: config.excerptChars,
      };
    }, concealed);
  }

  static store(
    files: Record<string, FixtureFile>,
    env: Record<string, string>,
    fetchLike: FetchLike = FakeFetchBoundary.respondingWith(200, {}).fetchLike,
    warnings: FakeWarningSink = new FakeWarningSink(),
  ): ConfigStore {
    const environment = new FakeEnvironment(env);
    return new ConfigStore(
      new FakeConfigBoundary(
        ConfigFixtureHarness.reads(files),
        environment.read(ConfigFixtureHarness.VERBOSITY_VARIABLE),
      ),
      ProviderRegistry.builtIn(fetchLike, environment.read, warnings.write),
    );
  }

  private static reads(files: Record<string, FixtureFile>): Record<string, ConfigFileRead> {
    return Object.fromEntries(
      Object.entries(files).map(([name, file]) => [name, ConfigFixtureHarness.read(file)]),
    );
  }

  private static read(file: FixtureFile): ConfigFileRead {
    if (typeof file === 'string') {
      return { found: true, raw: file };
    }
    if (file.$special !== ConfigFixtureHarness.UNREADABLE) {
      throw new Error(`unknown config file token "${file.$special}" in a spec fixture`);
    }
    return { found: false, reason: 'unreadable' };
  }
}

export { ConfigFixtureHarness };
