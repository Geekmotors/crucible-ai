import { JestBinding } from '../bindings/jest.js';
import type { TestBody } from '../bindings/jest.js';
import { config } from '../core/config.js';
import { CrucibleError } from '../core/errors.js';
import { Extractor } from '../core/extractor.js';
import type { ExtractedValue, ExtractedValueFor, ExtractType } from '../core/extract-type.js';
import { Judge } from '../core/judge.js';
import { JudgeExchange } from '../core/judge-exchange.js';
import type { CompletionTarget } from '../core/judge-exchange.js';
import { RetryingCompleter } from '../core/retry.js';
import { Reporter } from '../core/reporter.util.js';
import type { ReportSettings } from '../core/report-settings.js';
import { Runner } from '../core/runner.js';
import { TraceReporter } from '../core/trace-reporter.js';
import type { TraceSettings } from '../core/trace-reporter.js';
import type { RunOptions as ResolvableRunOptions } from '../core/run-options.js';
import { SchemaSource } from '../core/schema-source.js';
import { runScope } from '../core/state.js';
import { CrucibleVerdictError } from '../core/verdict-error.js';
import type { CoherentOptions } from './coherent-options.js';
import type { CrucibleSurface } from './crucible-surface.js';
import type { ExtractOptions } from './extract-options.js';
import type { RunOptions } from './run-options.js';

class CompositionRoot {
  private judge?: Judge;
  private extractor?: Extractor;
  private binding?: JestBinding;
  private schemaSource?: SchemaSource;
  private readonly trace = new TraceReporter(CompositionRoot.traceSettings, runScope);

  coherentJudge(): Judge {
    this.judge ??= new Judge(
      this.schemaSupplier('coherent'),
      this.exchange(),
      runScope,
      this.trace,
    );
    return this.judge;
  }

  valueExtractor(): Extractor {
    this.extractor ??= new Extractor(
      this.schemaSupplier('extract'),
      this.exchange(),
      runScope,
      this.trace,
    );
    return this.extractor;
  }

  private schemaSupplier(name: string): () => string {
    this.schemaSource ??= new SchemaSource();
    const source = this.schemaSource;
    return () => source.load(name);
  }

  private exchange(): JudgeExchange {
    return new JudgeExchange(
      new RetryingCompleter(this.trace),
      CompositionRoot.completionTarget,
      runScope,
      this.trace,
    );
  }

  jestBinding(): JestBinding {
    this.binding ??= new JestBinding(
      new Runner(
        runScope,
        new Reporter(CompositionRoot.reportSettings),
        CompositionRoot.testDefaults,
        this.trace,
      ),
    );
    return this.binding;
  }

  private static traceSettings(): TraceSettings {
    const { provider, model, meta, effectiveVerbosity, testDefaults, excerptChars } = config.get();
    return {
      verbosity: effectiveVerbosity,
      provider: provider.name,
      model,
      meta,
      testDefaults,
      excerptChars,
    };
  }

  private static testDefaults(): ResolvableRunOptions {
    return config.get().testDefaults;
  }

  private static reportSettings(): ReportSettings {
    const { excerptChars, effectiveVerbosity } = config.get();
    return { excerptChars, verbosity: effectiveVerbosity };
  }

  private static completionTarget(): CompletionTarget {
    const { provider, model, meta } = config.get();
    return { adapter: provider, model, meta };
  }
}

const compositionRoot = new CompositionRoot();

const crucible: Readonly<CrucibleSurface> = Object.freeze({
  it(
    name: string,
    optsOrBody: RunOptions | TestBody,
    bodyOrTimeout?: TestBody | number,
    timeout?: number,
  ): void {
    compositionRoot.jestBinding().register(name, optsOrBody, bodyOrTimeout, timeout);
  },
  describe(
    name: string,
    optsOrFn: RunOptions | (() => void),
    fn?: () => void,
    ...surplus: unknown[]
  ): void {
    compositionRoot.jestBinding().group(name, optsOrFn, fn, ...surplus);
  },
  coherent(actual: string, expectation: string, options?: CoherentOptions): Promise<boolean> {
    return compositionRoot.coherentJudge().judgeCoherent(actual, expectation, options);
  },
  extract<O extends ExtractOptions | undefined = undefined>(
    text: string,
    description: string,
    options?: O,
  ): Promise<ExtractedValueFor<O>> {
    return compositionRoot.valueExtractor().extract(text, description, options) as Promise<
      ExtractedValueFor<O>
    >;
  },
  facts(fact: string | readonly string[]): void {
    runScope.appendState(fact);
  },
  load(state: string | readonly string[]): void {
    runScope.appendState(state);
  },
  append(state: string | readonly string[]): void {
    runScope.appendState(state);
  },
});

export { crucible, CrucibleError, CrucibleVerdictError };
export type { VerdictOutcome } from '../core/verdict-error.js';
export type { CoherentOptions, ExtractedValue, ExtractOptions, ExtractType, RunOptions, TestBody };
export type { CrucibleErrorKind } from '../core/errors.js';
