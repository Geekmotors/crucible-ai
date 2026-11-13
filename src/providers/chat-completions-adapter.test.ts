import { describe, expect, it } from '@jest/globals';
import { CrucibleError } from '../core/errors.js';
import { Capture } from '../core/test/capture.util.js';
import { ApiKey } from './test/api-key.enum.js';
import { ChatAdapterHarness } from './test/chat-adapter-harness.util.js';
import { EndpointUrl } from './test/endpoint-url.enum.js';
import { FakeEnvironment } from './test/environment.fake.js';
import { FakeFetchBoundary } from './test/fetch-boundary.fake.js';
import { KeyEnv } from './test/key-env.enum.js';
import { TestModel } from './test/test-model.enum.js';

const RAW_JUDGE_REPLY = ChatAdapterHarness.rawJudgeReply;

describe('ChatCompletionsAdapter completion', () => {
  it('delivers the raw judge reply for core to parse, whitespace preserved', async () => {
    const boundary = FakeFetchBoundary.respondingWith(
      200,
      FakeFetchBoundary.successEnvelope(RAW_JUDGE_REPLY),
    );
    await expect(ChatAdapterHarness.complete(ChatAdapterHarness.adapter(boundary))).resolves.toBe(
      RAW_JUDGE_REPLY,
    );
  });

  it('reaches the chat completions path under the base URL with the bearer key', async () => {
    const boundary = FakeFetchBoundary.serving(EndpointUrl.Gateway, ApiKey.Valid, RAW_JUDGE_REPLY);
    await expect(ChatAdapterHarness.complete(ChatAdapterHarness.adapter(boundary))).resolves.toBe(
      RAW_JUDGE_REPLY,
    );
  });

  it('sends the trimmed key', async () => {
    const boundary = FakeFetchBoundary.serving(EndpointUrl.Gateway, ApiKey.Valid, RAW_JUDGE_REPLY);
    const environment = new FakeEnvironment({ [KeyEnv.Gateway]: ` ${ApiKey.Valid}\n` });
    await expect(
      ChatAdapterHarness.complete(ChatAdapterHarness.adapter(boundary, environment)),
    ).resolves.toBe(RAW_JUDGE_REPLY);
  });
});

describe('ChatCompletionsAdapter without a key variable', () => {
  it('calls the endpoint without credentials, whatever keys the environment holds', async () => {
    const boundary = FakeFetchBoundary.servingWithoutCredentials(
      EndpointUrl.Local,
      RAW_JUDGE_REPLY,
    );
    const adapter = ChatAdapterHarness.adapter(
      boundary,
      ChatAdapterHarness.keyedEnvironment(),
      ChatAdapterHarness.keylessEndpoint,
    );
    await expect(ChatAdapterHarness.complete(adapter)).resolves.toBe(RAW_JUDGE_REPLY);
  });
});

describe('ChatCompletionsAdapter missing API key', () => {
  it.each([undefined, '', ApiKey.Blank])('fails as config when the key is %p', async (key) => {
    const boundary = FakeFetchBoundary.respondingWith(
      200,
      FakeFetchBoundary.successEnvelope(RAW_JUDGE_REPLY),
    );
    const environment = new FakeEnvironment(key === undefined ? {} : { [KeyEnv.Gateway]: key });
    expect(
      await ChatAdapterHarness.failureKind(ChatAdapterHarness.adapter(boundary, environment)),
    ).toBe('config');
  });

  it('ignores keys held under other variables', async () => {
    const boundary = FakeFetchBoundary.respondingWith(
      200,
      FakeFetchBoundary.successEnvelope(RAW_JUDGE_REPLY),
    );
    const environment = new FakeEnvironment({ [KeyEnv.OpenRouter]: ApiKey.Valid });
    expect(
      await ChatAdapterHarness.failureKind(ChatAdapterHarness.adapter(boundary, environment)),
    ).toBe('config');
  });
});

describe('ChatCompletionsAdapter failure classification', () => {
  it.each([429, 408, 500, 502, 503])('classifies HTTP %i as retryable', async (status) => {
    const adapter = ChatAdapterHarness.adapter(FakeFetchBoundary.respondingWith(status, {}));
    expect(adapter.classifyFailure(await ChatAdapterHarness.failure(adapter))).toBe('retryable');
  });

  it.each([400, 401, 402, 403, 404, 405, 410, 422])(
    'classifies HTTP %i as fatal',
    async (status) => {
      const adapter = ChatAdapterHarness.adapter(FakeFetchBoundary.respondingWith(status, {}));
      expect(adapter.classifyFailure(await ChatAdapterHarness.failure(adapter))).toBe('fatal');
    },
  );

  it('classifies a wrong key as fatal', async () => {
    const boundary = FakeFetchBoundary.serving(EndpointUrl.Gateway, ApiKey.Valid, RAW_JUDGE_REPLY);
    const environment = new FakeEnvironment({ [KeyEnv.Gateway]: `${ApiKey.Valid}-revoked` });
    const adapter = ChatAdapterHarness.adapter(boundary, environment);
    expect(adapter.classifyFailure(await ChatAdapterHarness.failure(adapter))).toBe('fatal');
  });

  it('classifies network failure as retryable', async () => {
    const adapter = ChatAdapterHarness.adapter(
      FakeFetchBoundary.failing(new TypeError('fetch failed')),
    );
    expect(adapter.classifyFailure(await ChatAdapterHarness.failure(adapter))).toBe('retryable');
  });

  it('classifies an unparseable response body as retryable', async () => {
    const adapter = ChatAdapterHarness.adapter(FakeFetchBoundary.withUnparseableBody());
    expect(adapter.classifyFailure(await ChatAdapterHarness.failure(adapter))).toBe('retryable');
  });

  it.each([
    ['empty object', {}],
    ['empty choices', { choices: [] }],
    ['missing content', { choices: [{ message: {} }] }],
    ['non-string content', { choices: [{ message: { content: 42 } }] }],
  ])('classifies a malformed envelope (%s) as retryable', async (_label, envelope) => {
    const adapter = ChatAdapterHarness.adapter(FakeFetchBoundary.respondingWith(200, envelope));
    expect(adapter.classifyFailure(await ChatAdapterHarness.failure(adapter))).toBe('retryable');
  });
});

describe('ChatCompletionsAdapter 200-with-error envelope', () => {
  it('classifies an embedded error with a fatal numeric code as fatal', async () => {
    const adapter = ChatAdapterHarness.adapter(
      FakeFetchBoundary.respondingWith(200, { error: { code: 401 } }),
    );
    expect(adapter.classifyFailure(await ChatAdapterHarness.failure(adapter))).toBe('fatal');
  });

  it('classifies an embedded error with a retryable numeric code as retryable', async () => {
    const adapter = ChatAdapterHarness.adapter(
      FakeFetchBoundary.respondingWith(200, { error: { code: 502 } }),
    );
    expect(adapter.classifyFailure(await ChatAdapterHarness.failure(adapter))).toBe('retryable');
  });

  it('classifies an embedded error without a numeric code as retryable', async () => {
    const adapter = ChatAdapterHarness.adapter(
      FakeFetchBoundary.respondingWith(200, { error: { message: 'moderated' } }),
    );
    expect(adapter.classifyFailure(await ChatAdapterHarness.failure(adapter))).toBe('retryable');
  });
});

describe('ChatCompletionsAdapter invalid usage', () => {
  it('rejects unserializable meta as a usage failure', async () => {
    const boundary = FakeFetchBoundary.respondingWith(
      200,
      FakeFetchBoundary.successEnvelope(RAW_JUDGE_REPLY),
    );
    const error = await Capture.rejection(
      ChatAdapterHarness.adapter(boundary).complete(
        {
          model: TestModel.Generic,
          prompt: ChatAdapterHarness.judgePrompt,
          meta: { big: BigInt(1) as unknown as string },
        },
        new AbortController().signal,
      ),
    );
    expect(error).toBeInstanceOf(CrucibleError);
    expect((error as CrucibleError).kind).toBe('usage');
  });
});

describe('ChatCompletionsAdapter classification of crucible errors', () => {
  it('respects the retryable flag on infra errors', () => {
    const adapter = ChatAdapterHarness.adapter(FakeFetchBoundary.respondingWith(200, {}));
    expect(adapter.classifyFailure(new CrucibleError('infra', 'm', { retryable: true }))).toBe(
      'retryable',
    );
    expect(adapter.classifyFailure(new CrucibleError('infra', 'm', { retryable: false }))).toBe(
      'fatal',
    );
  });

  it('treats config and usage errors as fatal', () => {
    const adapter = ChatAdapterHarness.adapter(FakeFetchBoundary.respondingWith(200, {}));
    expect(adapter.classifyFailure(new CrucibleError('config', 'm'))).toBe('fatal');
    expect(adapter.classifyFailure(new CrucibleError('usage', 'm'))).toBe('fatal');
  });
});

describe('ChatCompletionsAdapter port contract', () => {
  it('rejects when the signal is already aborted', async () => {
    const boundary = FakeFetchBoundary.respondingWith(
      200,
      FakeFetchBoundary.successEnvelope(RAW_JUDGE_REPLY),
    );
    const controller = new AbortController();
    controller.abort();
    await expect(
      ChatAdapterHarness.adapter(boundary).complete(
        { model: TestModel.Generic, prompt: ChatAdapterHarness.judgePrompt },
        controller.signal,
      ),
    ).rejects.toBeInstanceOf(Error);
  });
});
