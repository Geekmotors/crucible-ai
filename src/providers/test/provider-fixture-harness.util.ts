import { ConfigFixtureHarness } from '../../core/test/config-fixture-harness.util.js';
import { FixtureOutcome } from '../../core/test/fixture-outcome.util.js';
import type { ObservedOutcome } from '../../core/test/fixture-outcome.util.js';
import { SleepRecorder } from '../../core/test/sleep-recorder.fake.js';
import { ConfigFileName } from '../../core/test/config-file-name.enum.js';
import { JudgeExchange } from '../../core/judge-exchange.js';
import { RetryingCompleter } from '../../core/retry.js';
import { RunScope } from '../../core/state.js';
import { TraceReporter } from '../../core/trace-reporter.js';
import { ProviderRegistry } from '../registry.js';
import { ApiKey } from './api-key.enum.js';
import { FakeEnvironment } from './environment.fake.js';
import { KeyEnv } from './key-env.enum.js';
import { ProviderName } from './provider-name.enum.js';
import { RequestEchoFetch } from './request-echo-fetch.fake.js';
import { ScriptedFetch } from './scripted-fetch.fake.js';
import type { ScriptedResponse } from './scripted-fetch.fake.js';
import { FakeWarningSink } from './warning-sink.fake.js';
import { TestModel } from './test-model.enum.js';

type RequestInput = {
  config: Record<string, unknown>;
  env?: Record<string, string>;
  system: string;
  prompt: string;
};

type ResponseInput = { responses: ScriptedResponse[] };

type PlainHttpInput = { baseUrl: string; keySent: boolean };

class ProviderFixtureHarness {
  private static CONTRACT = 'echoed request';

  static request(input: unknown, concealed: string[]): Promise<ObservedOutcome> {
    const { config, env = {}, system, prompt } = input as RequestInput;
    const scope = new RunScope();
    return FixtureOutcome.settled(() => {
      const loaded = ConfigFixtureHarness.store(
        { [ConfigFileName.Json]: JSON.stringify(config) },
        env,
        new RequestEchoFetch().fetchLike,
      ).get();
      const trace = new TraceReporter();
      const exchange = new JudgeExchange(
        new RetryingCompleter(trace, new SleepRecorder().sleep),
        () => ({ adapter: loaded.provider, model: loaded.model, meta: loaded.meta }),
        scope,
        trace,
      );
      return scope.enterRun(() =>
        exchange.ask({
          system,
          prompt,
          contract: ProviderFixtureHarness.CONTRACT,
          read: (reply) => reply,
        }),
      );
    }, concealed);
  }

  static async response(input: unknown): Promise<ObservedOutcome> {
    const { responses } = input as ResponseInput;
    const fetch = new ScriptedFetch(responses);
    const adapter = ProviderRegistry.builtIn(
      fetch.fetchLike,
      new FakeEnvironment({ [KeyEnv.Default]: ApiKey.Valid }).read,
      new FakeWarningSink().write,
    ).create(ProviderName.OpenRouter, {});
    const outcome = await FixtureOutcome.rendered(() =>
      new RetryingCompleter(new TraceReporter(), new SleepRecorder().sleep).complete(
        adapter,
        { model: TestModel.Generic, prompt: ProviderFixtureHarness.CONTRACT },
        new AbortController().signal,
      ),
    );
    FixtureOutcome.requireEnoughScript(fetch.overran);
    return outcome;
  }

  static plainHttpWarning(input: unknown): Promise<ObservedOutcome> {
    const { baseUrl, keySent } = input as PlainHttpInput;
    const warnings = new FakeWarningSink();
    return FixtureOutcome.settled(async () => {
      const loaded = ConfigFixtureHarness.store(
        {
          [ConfigFileName.Json]: JSON.stringify({
            provider: ProviderName.OpenAiCompatible,
            model: TestModel.Generic,
            baseUrl,
          }),
        },
        keySent ? { [KeyEnv.Default]: ApiKey.Valid } : {},
        new RequestEchoFetch().fetchLike,
        warnings,
      ).get();
      await loaded.provider.complete(
        { model: loaded.model, prompt: ProviderFixtureHarness.CONTRACT },
        new AbortController().signal,
      );
      return warnings.lines.length > 0;
    });
  }
}

export { ProviderFixtureHarness };
