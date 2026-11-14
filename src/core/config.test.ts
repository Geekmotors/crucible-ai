import { describe, expect, it } from '@jest/globals';
import { ConfigHarness } from './test/config-harness.util.js';
import { ConfigSchemaHarness } from './test/config-schema-harness.util.js';
import { ApiKey } from '../providers/test/api-key.enum.js';
import { ChatAdapterHarness } from '../providers/test/chat-adapter-harness.util.js';
import { EndpointUrl } from '../providers/test/endpoint-url.enum.js';
import { FakeEnvironment } from '../providers/test/environment.fake.js';
import { FakeFetchBoundary } from '../providers/test/fetch-boundary.fake.js';
import { KeyEnv } from '../providers/test/key-env.enum.js';
import { TestModel } from '../providers/test/test-model.enum.js';
import { RunCount } from './test/run-count.enum.js';
import { ProviderName } from '../providers/test/provider-name.enum.js';

describe('ConfigStore', () => {
  it('memoizes: repeated gets return the same config instance', () => {
    const store = ConfigHarness.store({ provider: 'fake', model: TestModel.Generic });
    expect(store.get()).toBe(store.get());
  });

  it('creates the adapter of the configured provider from the registry', () => {
    const store = ConfigHarness.store({ provider: 'fake', model: TestModel.Generic });
    expect(store.get().provider).toBe(ConfigHarness.fakeAdapter);
  });
});

describe('ConfigStore and the shipped JSON Schema agree on defaults', () => {
  const reply = ChatAdapterHarness.rawJudgeReply;
  const judge = { provider: ProviderName.OpenRouter, model: TestModel.Generic };

  it('a config holding every schema default resolves like one that sets none', () => {
    const explicit = ConfigHarness.builtInStore({ ...ConfigSchemaHarness.defaults(), ...judge });
    expect(ConfigHarness.resolvedSettings(explicit)).toEqual(
      ConfigHarness.resolvedSettings(ConfigHarness.builtInStore(judge)),
    );
  });

  it('schema defaults keep the test timeout growing with runs', () => {
    const runs = { runs: RunCount.Gated };
    const explicit = ConfigHarness.builtInStore({
      ...ConfigSchemaHarness.defaultsWithTestDefaults(runs),
      ...judge,
    });
    expect(ConfigHarness.resolvedSettings(explicit)).toEqual(
      ConfigHarness.resolvedSettings(ConfigHarness.builtInStore({ ...judge, testDefaults: runs })),
    );
  });

  it('the schema default key variable is the one the judge reads', async () => {
    const store = ConfigHarness.builtInStore(
      { ...ConfigSchemaHarness.defaults(), ...judge },
      FakeFetchBoundary.serving(EndpointUrl.OpenRouter, ApiKey.Valid, reply),
      new FakeEnvironment({ [KeyEnv.Default]: ApiKey.Valid }),
    );
    await expect(ChatAdapterHarness.complete(store.get().provider)).resolves.toBe(reply);
  });
});
