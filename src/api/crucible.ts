import { JestBinding } from '../bindings/jest.js';
import type { TestBody as BindingTestBody } from '../bindings/jest.js';
import { config } from '../core/config.js';
import { CrucibleError } from '../core/errors.js';
import { Extractor } from '../core/extractor.js';
import { Gate } from '../core/gate.js';
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
import { ScopedAssertions } from '../core/scoped-assertions.js';
import { runScope } from '../core/state.js';
import { CrucibleVerdictError } from '../core/verdict-error.js';
import type { CoherentOptions } from './coherent-options.js';
import type { CrucibleSurface } from './crucible-surface.js';
import type { ExtractOptions } from './extract-options.js';
import type { GateBody, GatedTest, RunContext, TestBody } from './run-context.js';
import type { RunOptions } from './run-options.js';

class CompositionRoot {
  private judge?: Judge;
  private extractor?: Extractor;
  private binding?: JestBinding;
  private testGate?: Gate;
  private scopedAssertions?: ScopedAssertions;
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

  assertions(): ScopedAssertions {
    this.scopedAssertions ??= new ScopedAssertions(
      runScope,
      () => this.coherentJudge(),
      () => this.valueExtractor(),
    );
    return this.scopedAssertions;
  }

  gate(): Gate {
    this.testGate ??= new Gate(
      new Runner(
        runScope,
        new Reporter(CompositionRoot.reportSettings),
        CompositionRoot.testDefaults,
        this.trace,
      ),
      this.assertions(),
    );
    return this.testGate;
  }

  jestBinding(): JestBinding {
    this.binding ??= new JestBinding(this.gate());
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
    compositionRoot
      .jestBinding()
      .register(
        name,
        optsOrBody as RunOptions | BindingTestBody,
        bodyOrTimeout as BindingTestBody | number | undefined,
        timeout,
      );
  },
  gate(optsOrBody: RunOptions | GateBody, body?: GateBody, ...surplus: unknown[]): GatedTest {
    return compositionRoot.gate().wrap(optsOrBody, body, ...surplus);
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
    return compositionRoot.assertions().coherent(actual, expectation, options);
  },
  extract<O extends ExtractOptions | undefined = undefined>(
    text: string,
    description: string,
    options?: O,
  ): Promise<ExtractedValueFor<O>> {
    return compositionRoot.assertions().extract(text, description, options);
  },
  facts(fact: string | readonly string[]): void {
    compositionRoot.assertions().facts(fact);
  },
  load(state: string | readonly string[]): void {
    compositionRoot.assertions().facts(state);
  },
  append(state: string | readonly string[]): void {
    compositionRoot.assertions().facts(state);
  },
});

export { crucible, CrucibleError, CrucibleVerdictError };
export type { VerdictOutcome } from '../core/verdict-error.js';
export type {
  CoherentOptions,
  ExtractedValue,
  ExtractOptions,
  ExtractType,
  GateBody,
  GatedTest,
  RunContext,
  RunOptions,
  TestBody,
};
export type { CrucibleErrorKind } from '../core/errors.js';
