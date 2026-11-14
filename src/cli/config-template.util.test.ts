import { describe, expect, it } from '@jest/globals';
import { JudgeModel } from './test/judge-model.enum.js';
import { ReasoningEffort } from './test/reasoning-effort.enum.js';
import { TemplateHarness } from './test/template-harness.util.js';
import { ConfigHarness } from '../core/test/config-harness.util.js';
import { RunCount } from '../core/test/run-count.enum.js';
import { Threshold } from '../core/test/threshold.enum.js';
import { InferenceTimeout } from '../core/test/inference-timeout.enum.js';
import { ChatAdapterHarness } from '../providers/test/chat-adapter-harness.util.js';

describe('the generated config file as written', () => {
  it('loads with the recommended judge model', () => {
    expect(TemplateHarness.store(TemplateHarness.generated()).get().model).toBe(
      JudgeModel.Recommended,
    );
  });

  it('asks OpenRouter for low reasoning effort to speed up the recommended model', () => {
    expect(TemplateHarness.store(TemplateHarness.generated()).get().meta).toEqual({
      reasoning: { effort: ReasoningEffort.Low },
    });
  });

  it('resolves every other setting to its built-in default', () => {
    expect(
      ConfigHarness.resolvedSettings(TemplateHarness.store(TemplateHarness.generated())),
    ).toEqual(TemplateHarness.builtInsWithLowReasoning());
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
    });
  });

  it('still resolves every other setting to its built-in default', () => {
    expect(
      ConfigHarness.resolvedSettings(
        TemplateHarness.store(TemplateHarness.withEverySettingUncommented()),
      ),
    ).toEqual(TemplateHarness.builtInsWithLowReasoning());
  });

  it('still judges with the key from CRUCIBLE_JUDGE_KEY', async () => {
    const store = TemplateHarness.store(TemplateHarness.withEverySettingUncommented());
    await expect(ChatAdapterHarness.complete(store.get().provider)).resolves.toBe(
      TemplateHarness.reply,
    );
  });
});
