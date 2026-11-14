import { describe, expect, it } from '@jest/globals';
import { CrucibleError } from '../core/errors.js';
import { Capture } from '../core/test/capture.util.js';
import { ChatAdapterHarness } from './test/chat-adapter-harness.util.js';
import { FakeFetchBoundary } from './test/fetch-boundary.fake.js';
import { TestModel } from './test/test-model.enum.js';

const RAW_JUDGE_REPLY = ChatAdapterHarness.rawJudgeReply;

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
