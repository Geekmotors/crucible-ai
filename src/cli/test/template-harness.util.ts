import { ConfigTemplate } from '../config-template.util.js';
import { JudgeModel } from './judge-model.enum.js';
import { ReasoningEffort } from './reasoning-effort.enum.js';
import type { ConfigStore } from '../../core/config.js';
import { ConfigHarness } from '../../core/test/config-harness.util.js';
import { ApiKey } from '../../providers/test/api-key.enum.js';
import { ChatAdapterHarness } from '../../providers/test/chat-adapter-harness.util.js';
import { EndpointUrl } from '../../providers/test/endpoint-url.enum.js';
import { FakeEnvironment } from '../../providers/test/environment.fake.js';
import { FakeFetchBoundary } from '../../providers/test/fetch-boundary.fake.js';
import { KeyEnv } from '../../providers/test/key-env.enum.js';
import { ProviderName } from '../../providers/test/provider-name.enum.js';

class TemplateHarness {
  static commentedSetting = /^([ \t]*)\/\/ ([ \t]*["}])/gm;
  static reply = ChatAdapterHarness.rawJudgeReply;

  static generated(): string {
    return new ConfigTemplate().render();
  }

  static withEverySettingUncommented(): string {
    return TemplateHarness.generated().replace(TemplateHarness.commentedSetting, '$1$2');
  }

  static store(raw: string): ConfigStore {
    return ConfigHarness.builtInJsoncStore(
      raw,
      FakeFetchBoundary.serving(EndpointUrl.OpenRouter, ApiKey.Valid, TemplateHarness.reply),
      new FakeEnvironment({ [KeyEnv.Default]: ApiKey.Valid }),
    );
  }

  static builtInsWithLowReasoning(): Record<string, unknown> {
    return ConfigHarness.resolvedSettings(
      ConfigHarness.builtInStore({
        provider: ProviderName.OpenRouter,
        model: JudgeModel.Recommended,
        meta: { reasoning: { effort: ReasoningEffort.Low } },
      }),
    );
  }
}

export { TemplateHarness };
