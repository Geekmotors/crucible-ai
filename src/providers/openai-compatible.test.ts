import { describe, expect, it } from '@jest/globals';
import { Capture } from '../core/test/capture.util.js';
import { CrucibleError } from '../core/errors.js';
import { ApiKey } from './test/api-key.enum.js';
import { BaseUrl } from './test/base-url.enum.js';
import { ChatAdapterHarness } from './test/chat-adapter-harness.util.js';
import { CompatibleProviderHarness } from './test/compatible-provider-harness.util.js';
import { EndpointUrl } from './test/endpoint-url.enum.js';
import { FakeEnvironment } from './test/environment.fake.js';
import { FakeFetchBoundary } from './test/fetch-boundary.fake.js';
import { KeyEnv } from './test/key-env.enum.js';
import { TestModel } from './test/test-model.enum.js';

const REPLY = ChatAdapterHarness.rawJudgeReply;
const UNSERIALIZABLE_META = { big: BigInt(1) as unknown as string };

describe('OpenAiCompatibleProvider key source', () => {
  it('judges through <baseUrl>/chat/completions with the key from the named variable', async () => {
    const adapter = new CompatibleProviderHarness(
      FakeFetchBoundary.serving(EndpointUrl.Gateway, ApiKey.Valid, REPLY),
      new FakeEnvironment({ [KeyEnv.Gateway]: ApiKey.Valid, [KeyEnv.Default]: ApiKey.Other }),
    ).create({ baseUrl: BaseUrl.Gateway, apiKeyEnv: KeyEnv.Gateway });
    await expect(ChatAdapterHarness.complete(adapter)).resolves.toBe(REPLY);
  });

  it('sends the key from CRUCIBLE_JUDGE_KEY when no variable is named', async () => {
    const adapter = new CompatibleProviderHarness(
      FakeFetchBoundary.serving(EndpointUrl.Gateway, ApiKey.Valid, REPLY),
      new FakeEnvironment({ [KeyEnv.Default]: ApiKey.Valid }),
    ).create({ baseUrl: BaseUrl.Gateway });
    await expect(ChatAdapterHarness.complete(adapter)).resolves.toBe(REPLY);
  });

  it.each([
    {},
    { [KeyEnv.Default]: ApiKey.Empty },
    { [KeyEnv.Default]: ApiKey.Blank },
    { [KeyEnv.LegacyOpenAi]: ApiKey.Valid },
  ])(
    'sends no credentials when no variable is named and CRUCIBLE_JUDGE_KEY is unset or blank (%p)',
    async (variables) => {
      const adapter = new CompatibleProviderHarness(
        FakeFetchBoundary.servingWithoutCredentials(EndpointUrl.Local, REPLY),
        new FakeEnvironment(variables),
      ).create({ baseUrl: BaseUrl.Local });
      await expect(ChatAdapterHarness.complete(adapter)).resolves.toBe(REPLY);
    },
  );

  it.each([{}, { [KeyEnv.Gateway]: ApiKey.Empty }, { [KeyEnv.Default]: ApiKey.Valid }])(
    'fails as config when the named key variable is unset or empty (%p)',
    async (variables) => {
      const adapter = new CompatibleProviderHarness(
        FakeFetchBoundary.serving(EndpointUrl.Gateway, ApiKey.Valid, REPLY),
        new FakeEnvironment(variables),
      ).create({ baseUrl: BaseUrl.Gateway, apiKeyEnv: KeyEnv.Gateway });
      expect(await ChatAdapterHarness.failureKind(adapter)).toBe('config');
    },
  );

  it('cannot be created without a base URL', () => {
    const harness = new CompatibleProviderHarness(
      FakeFetchBoundary.servingWithoutCredentials(EndpointUrl.Local, REPLY),
    );
    const error = Capture.thrown(() => harness.create({}));
    expect(error).toBeInstanceOf(CrucibleError);
    expect((error as CrucibleError).kind).toBe('config');
  });
});

describe('OpenAiCompatibleProvider plain-http warning', () => {
  it('warns once when a key goes over plain http to a remote host', async () => {
    const harness = new CompatibleProviderHarness(
      FakeFetchBoundary.serving(EndpointUrl.PlainHttpGateway, ApiKey.Valid, REPLY),
      new FakeEnvironment({ [KeyEnv.Default]: ApiKey.Valid }),
    );
    const adapter = harness.create({ baseUrl: BaseUrl.PlainHttpGateway });
    await ChatAdapterHarness.complete(adapter);
    await ChatAdapterHarness.complete(adapter);
    await ChatAdapterHarness.complete(harness.create({ baseUrl: BaseUrl.PlainHttpGateway }));
    expect(harness.warnings.lines).toHaveLength(1);
  });

  it('never puts the key in the warning', async () => {
    const harness = new CompatibleProviderHarness(
      FakeFetchBoundary.serving(EndpointUrl.PlainHttpGateway, ApiKey.Valid, REPLY),
      new FakeEnvironment({ [KeyEnv.Default]: ApiKey.Valid }),
    );
    await ChatAdapterHarness.complete(harness.create({ baseUrl: BaseUrl.PlainHttpGateway }));
    expect(harness.warnings.lines.join('\n')).not.toContain(ApiKey.Valid);
  });

  it('warns when the key from the named variable goes over plain http to a remote host', async () => {
    const harness = new CompatibleProviderHarness(
      FakeFetchBoundary.serving(EndpointUrl.PlainHttpGateway, ApiKey.Valid, REPLY),
      new FakeEnvironment({ [KeyEnv.Gateway]: ApiKey.Valid }),
    );
    await ChatAdapterHarness.complete(
      harness.create({ baseUrl: BaseUrl.PlainHttpGateway, apiKeyEnv: KeyEnv.Gateway }),
    );
    expect(harness.warnings.lines).toHaveLength(1);
  });

  it.each([BaseUrl.LoopbackLookalikeAddress, BaseUrl.LoopbackLookalikeName])(
    'warns for %s, a remote host that only looks local',
    async (baseUrl) => {
      const harness = new CompatibleProviderHarness(
        FakeFetchBoundary.respondingWith(200, FakeFetchBoundary.successEnvelope(REPLY)),
        new FakeEnvironment({ [KeyEnv.Default]: ApiKey.Valid }),
      );
      await ChatAdapterHarness.complete(harness.create({ baseUrl }));
      expect(harness.warnings.lines).toHaveLength(1);
    },
  );

  it('does not warn when the request is never sent', async () => {
    const harness = new CompatibleProviderHarness(
      FakeFetchBoundary.serving(EndpointUrl.PlainHttpGateway, ApiKey.Valid, REPLY),
      new FakeEnvironment({ [KeyEnv.Default]: ApiKey.Valid }),
    );
    await Capture.rejection(
      harness.create({ baseUrl: BaseUrl.PlainHttpGateway }).complete(
        {
          model: TestModel.Generic,
          prompt: ChatAdapterHarness.judgePrompt,
          meta: UNSERIALIZABLE_META,
        },
        new AbortController().signal,
      ),
    );
    expect(harness.warnings.lines).toHaveLength(0);
  });

  it('still makes the call over plain http', async () => {
    const adapter = new CompatibleProviderHarness(
      FakeFetchBoundary.serving(EndpointUrl.PlainHttpGateway, ApiKey.Valid, REPLY),
      new FakeEnvironment({ [KeyEnv.Gateway]: ApiKey.Valid }),
    ).create({ baseUrl: BaseUrl.PlainHttpGateway, apiKeyEnv: KeyEnv.Gateway });
    await expect(ChatAdapterHarness.complete(adapter)).resolves.toBe(REPLY);
  });

  it.each([
    BaseUrl.Local,
    BaseUrl.LoopbackIpv4,
    BaseUrl.LoopbackIpv4Range,
    BaseUrl.LoopbackIpv6,
    BaseUrl.LoopbackIpv6Expanded,
    BaseUrl.LoopbackIpv4Shorthand,
    BaseUrl.LoopbackUppercase,
    BaseUrl.Gateway,
  ])('does not warn when the key goes to %s', async (baseUrl) => {
    const harness = new CompatibleProviderHarness(
      FakeFetchBoundary.respondingWith(200, FakeFetchBoundary.successEnvelope(REPLY)),
      new FakeEnvironment({ [KeyEnv.Default]: ApiKey.Valid }),
    );
    await ChatAdapterHarness.complete(harness.create({ baseUrl }));
    expect(harness.warnings.lines).toHaveLength(0);
  });

  it('does not warn when no key is sent over plain http', async () => {
    const harness = new CompatibleProviderHarness(
      FakeFetchBoundary.servingWithoutCredentials(EndpointUrl.PlainHttpGateway, REPLY),
    );
    await ChatAdapterHarness.complete(harness.create({ baseUrl: BaseUrl.PlainHttpGateway }));
    expect(harness.warnings.lines).toHaveLength(0);
  });
});
