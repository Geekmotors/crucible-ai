import { JudgeTransport } from '../judge-transport.js';
import type { FetchLike } from '../provider-boundary.js';
import { ProviderRegistry } from '../registry.js';
import type { ProviderAdapter, ProviderSettings } from '../types.js';
import { ApiKey } from './api-key.enum.js';
import { FakeEnvironment } from './environment.fake.js';
import { FakeFetchBoundary } from './fetch-boundary.fake.js';
import { KeyEnv } from './key-env.enum.js';
import { TestModel } from './test-model.enum.js';
import { TransportReply } from './transport-reply.enum.js';
import { FakeWarningSink } from './warning-sink.fake.js';

class TransportHarness {
  private static OK = 200;

  static serving(text: string): FetchLike {
    return FakeFetchBoundary.respondingWith(
      TransportHarness.OK,
      FakeFetchBoundary.successEnvelope(text),
    ).fetchLike;
  }

  static transport(): JudgeTransport {
    return new JudgeTransport(TransportHarness.serving(TransportReply.Default));
  }

  static adapter(
    transport: JudgeTransport,
    provider: string,
    settings: ProviderSettings,
  ): ProviderAdapter {
    return ProviderRegistry.builtIn(
      transport.fetchLike,
      new FakeEnvironment({ [KeyEnv.Default]: ApiKey.Valid }).read,
      new FakeWarningSink().write,
    ).create(provider, settings);
  }

  static async reply(adapter: ProviderAdapter): Promise<string> {
    const { reply } = await adapter.complete(
      { model: TestModel.Generic, prompt: TransportReply.Chosen },
      new AbortController().signal,
    );
    return reply;
  }
}

export { TransportHarness };
