import { config } from './config.js';
import { Extractor } from './extractor.js';
import { Gate } from './gate.js';
import { GroupSettings } from './group-settings.js';
import { Judge } from './judge.js';
import { JudgeExchange } from './judge-exchange.js';
import type { CompletionTarget } from './judge-exchange.js';
import { RetryingCompleter } from './retry.js';
import { Reporter } from './reporter.util.js';
import type { ReportSettings } from './report-settings.js';
import { Runner } from './runner.js';
import type { RunnerSpec } from './runner-spec.js';
import { RunnerWrapper } from './runner-wrapper.js';
import type { RunOptions } from './run-options.js';
import { SchemaSource } from './schema-source.js';
import { ScopedAssertions } from './scoped-assertions.js';
import { runScope } from './state.js';
import { TraceReporter } from './trace-reporter.js';
import type { TraceSettings } from './trace-reporter.js';

class CompositionRoot {
  private judge?: Judge;
  private extractor?: Extractor;
  private wrapper?: RunnerWrapper;
  private testGate?: Gate;
  private scopedAssertions?: ScopedAssertions;
  private schemaSource?: SchemaSource;
  private readonly trace = new TraceReporter(CompositionRoot.traceSettings, runScope);

  constructor(private readonly spec: RunnerSpec) {}

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
      new GroupSettings(this.spec.groupPath),
    );
    return this.testGate;
  }

  runnerWrapper(): RunnerWrapper {
    this.wrapper ??= new RunnerWrapper(this.gate(), this.spec);
    return this.wrapper;
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

  private static testDefaults(): RunOptions {
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

export { CompositionRoot };
