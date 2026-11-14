import type { ProviderAdapter } from '../../providers/types.js';
import { Extractor } from '../extractor.js';
import type { ExtractedValue, ExtractOptions } from '../extract-type.js';
import type { Deadline } from '../judge-exchange.js';
import { RunScope } from '../state.js';
import type { RunContext } from '../state.js';
import { TraceReporter } from '../trace-reporter.js';
import { Capture } from './capture.util.js';
import { ExtractTarget } from './extract-target.enum.js';
import { ExtractText } from './extract-text.enum.js';
import { JudgeHarness } from './judge-harness.util.js';
import { FactAwareJudge } from './fact-aware-judge.fake.js';
import { ExtractReply } from './extract-reply.enum.js';
import { ModeAwareJudge } from './mode-aware-judge.fake.js';
import { ScriptedAdapter } from './scripted-adapter.fake.js';
import { TraceHarness } from './trace-harness.util.js';

class ExtractorHarness {
  static extractor(
    adapter: ProviderAdapter,
    scope: RunScope,
    deadline?: Deadline,
    trace: TraceReporter = new TraceReporter(),
  ): Extractor {
    return new Extractor(
      JudgeHarness.schemaText,
      JudgeHarness.exchange(adapter, scope, deadline, trace),
      scope,
      trace,
    );
  }

  static factExtractor(scope: RunScope, facts: readonly string[]): Extractor {
    return ExtractorHarness.extractor(
      new FactAwareJudge(facts, ExtractReply.Two, ExtractReply.Hedged),
      scope,
    );
  }

  static scripted(replies: string[]): ScriptedAdapter {
    return new ScriptedAdapter(
      replies.map((reply) => ({ resolve: reply })),
      'retryable',
    );
  }

  static extractedFrom(replies: string[], options?: ExtractOptions): Promise<ExtractedValue> {
    const scope = new RunScope();
    const extractor = ExtractorHarness.extractor(ExtractorHarness.scripted(replies), scope);
    return scope.enterRun(() =>
      extractor.extract(ExtractText.Response, ExtractTarget.Apples, options),
    );
  }

  static extracted(reply: string, options?: ExtractOptions): Promise<ExtractedValue> {
    return ExtractorHarness.extractedFrom([reply, reply], options);
  }

  static failure(reply: string, options?: ExtractOptions): Promise<unknown> {
    return Capture.rejection(ExtractorHarness.extracted(reply, options));
  }

  static usageFailure(text: unknown, description: unknown, options?: unknown): Promise<unknown> {
    const scope = new RunScope();
    const extractor = ExtractorHarness.extractor(ExtractorHarness.scripted([]), scope);
    return scope.enterRun(() =>
      Capture.rejection(
        extractor.extract(text as string, description as string, options as ExtractOptions),
      ),
    );
  }

  static async recordedContext(replies: string[], options?: ExtractOptions): Promise<RunContext> {
    const scope = new RunScope();
    const extractor = ExtractorHarness.extractor(ExtractorHarness.scripted(replies), scope);
    return scope.enterRun(async () => {
      await extractor
        .extract(ExtractText.Response, ExtractTarget.Apples, options)
        .catch(() => undefined);
      return scope.context();
    });
  }

  static leaning(options?: ExtractOptions, strictRun?: boolean): Promise<ExtractedValue> {
    const scope = new RunScope();
    const extractor = ExtractorHarness.extractor(new ModeAwareJudge(), scope);
    return scope.enterRun(
      () => extractor.extract(ExtractText.Response, ExtractTarget.Apples, options),
      undefined,
      undefined,
      undefined,
      strictRun,
    );
  }

  static async leaningContext(options?: ExtractOptions, strictRun?: boolean): Promise<RunContext> {
    const scope = new RunScope();
    const extractor = ExtractorHarness.extractor(new ModeAwareJudge(), scope);
    return scope.enterRun(
      async () => {
        await extractor.extract(ExtractText.Response, ExtractTarget.Apples, options);
        return scope.context();
      },
      undefined,
      undefined,
      undefined,
      strictRun,
    );
  }

  static async tracedOutput(replies: string[], traced: TraceHarness): Promise<string> {
    const extractor = ExtractorHarness.extractor(
      ExtractorHarness.scripted(replies),
      traced.scope,
      undefined,
      traced.trace(),
    );
    await traced.scope
      .enterRun(() =>
        extractor.extract(ExtractText.Response, ExtractTarget.Apples, { as: 'number' }),
      )
      .catch(() => undefined);
    return traced.output.text;
  }
}

export { ExtractorHarness };
