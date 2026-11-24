import { describe, expect, it } from '@jest/globals';
import { ConfigTemplate } from './config-template.util.js';
import { InitProviderName } from './test/init-provider-name.enum.js';
import { JudgeModel } from './test/judge-model.enum.js';
import { TemplateHarness } from './test/template-harness.util.js';
import { ConfigHarness } from '../core/test/config-harness.util.js';
import { RunCount } from '../core/test/run-count.enum.js';
import { Threshold } from '../core/test/threshold.enum.js';
import { InferenceTimeout } from '../core/test/inference-timeout.enum.js';
import { ChatAdapterHarness } from '../providers/test/chat-adapter-harness.util.js';
import { BaseUrl } from '../providers/test/base-url.enum.js';
import { TestModel } from '../providers/test/test-model.enum.js';

describe('the generated config file as written', () => {
  it('loads with the recommended judge model', () => {
    expect(TemplateHarness.store(TemplateHarness.generated()).get().model).toBe(
      JudgeModel.Recommended,
    );
  });

  it('sends no extra request fields to the judge', () => {
    expect(TemplateHarness.store(TemplateHarness.generated()).get().meta).toBeUndefined();
  });

  it('resolves every other setting to its built-in default', () => {
    expect(
      ConfigHarness.resolvedSettings(TemplateHarness.store(TemplateHarness.generated())),
    ).toEqual(TemplateHarness.builtInsForRecommendedJudge());
  });

  it('judges through OpenRouter with the key from CRUCIBLE_JUDGE_KEY', async () => {
    const store = TemplateHarness.store(TemplateHarness.generated());
    await expect(ChatAdapterHarness.complete(store.get().provider)).resolves.toBe(
      TemplateHarness.reply,
    );
  });
});

describe('the generated config file with every commented setting uncommented', () => {
  it('declares every fixed run option explicitly at its built-in value', () => {
    const store = TemplateHarness.store(TemplateHarness.withEverySettingUncommented());
    expect(store.get().testDefaults).toEqual({
      runs: RunCount.BuiltIn,
      threshold: Threshold.BuiltIn,
      inferenceTimeout: InferenceTimeout.BuiltInMs,
      strict: false,
    });
  });

  it('still resolves every other setting to its built-in default', () => {
    expect(
      ConfigHarness.resolvedSettings(
        TemplateHarness.store(TemplateHarness.withEverySettingUncommented()),
      ),
    ).toEqual(TemplateHarness.builtInsForRecommendedJudge());
  });

  it('still judges with the key from CRUCIBLE_JUDGE_KEY', async () => {
    const store = TemplateHarness.store(TemplateHarness.withEverySettingUncommented());
    await expect(ChatAdapterHarness.complete(store.get().provider)).resolves.toBe(
      TemplateHarness.reply,
    );
  });
});

describe('the generated config file for openrouter', () => {
  it('is the default template', () => {
    expect(TemplateHarness.generatedFor(InitProviderName.OpenRouter)).toBe(
      TemplateHarness.generated(),
    );
  });
});

describe('the generated config file for openai', () => {
  it('does not load until the model is filled in', () => {
    const store = TemplateHarness.openAiStore(
      TemplateHarness.generatedFor(InitProviderName.OpenAi),
    );
    expect(ConfigHarness.errorKind(store)).toBe('config');
  });

  it('judges through OpenAI with the key from CRUCIBLE_JUDGE_KEY once the model is filled in', async () => {
    const raw = TemplateHarness.filledIn(
      TemplateHarness.generatedFor(InitProviderName.OpenAi),
      'model',
      TestModel.Generic,
    );
    const store = TemplateHarness.openAiStore(raw);
    await expect(ChatAdapterHarness.complete(store.get().provider)).resolves.toBe(
      TemplateHarness.reply,
    );
  });
});

describe('the generated config file for openai-compatible', () => {
  it('does not load until the base URL and model are filled in', () => {
    const store = TemplateHarness.localServerStore(
      TemplateHarness.generatedFor(InitProviderName.OpenAiCompatible),
    );
    expect(ConfigHarness.errorKind(store)).toBe('config');
  });

  it('judges through the filled-in server without a key once both are filled in', async () => {
    const generated = TemplateHarness.generatedFor(InitProviderName.OpenAiCompatible);
    const withBaseUrl = TemplateHarness.filledIn(generated, 'baseUrl', BaseUrl.Local);
    const store = TemplateHarness.localServerStore(
      TemplateHarness.filledIn(withBaseUrl, 'model', TestModel.Generic),
    );
    await expect(ChatAdapterHarness.complete(store.get().provider)).resolves.toBe(
      TemplateHarness.reply,
    );
  });
});

describe('a config template for a provider init does not offer', () => {
  it('does not exist', () => {
    expect(ConfigTemplate.forProvider(InitProviderName.Unknown)).toBeUndefined();
  });
});
