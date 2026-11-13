import { JestBinding } from '../bindings/jest.js';
import type { TestBody } from '../bindings/jest.js';
import { config } from '../core/config.js';
import { CrucibleError } from '../core/errors.js';
import { Judge } from '../core/judge.js';
import type { CompletionTarget } from '../core/judge.js';
import { RetryingCompleter } from '../core/retry.js';
import { Reporter } from '../core/reporter.util.js';
import type { ReportSettings } from '../core/report-settings.js';
import { Runner } from '../core/runner.js';
import { TraceReporter } from '../core/trace-reporter.js';
import type { TraceSettings } from '../core/trace-reporter.js';
import type { RunOptions } from '../core/run-options.js';
import { SchemaSource } from '../core/schema-source.js';
import { runScope } from '../core/state.js';
import { CrucibleVerdictError } from '../core/verdict-error.js';

class CompositionRoot {
  private judge?: Judge;
  private binding?: JestBinding;
  private readonly trace = new TraceReporter(CompositionRoot.traceSettings, runScope);

  coherentJudge(): Judge {
    this.judge ??= new Judge(
      CompositionRoot.coherentSchemaSupplier(),
      new RetryingCompleter(this.trace),
      CompositionRoot.completionTarget,
      runScope,
      this.trace,
    );
    return this.judge;
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

  private static coherentSchemaSupplier(): () => string {
    const source = new SchemaSource();
    return () => source.load('coherent');
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

const compositionRoot = new CompositionRoot();

const crucible = Object.freeze({
  it(
    name: string,
    optsOrBody: RunOptions | TestBody,
    bodyOrTimeout?: TestBody | number,
    timeout?: number,
  ): void {
    compositionRoot.jestBinding().register(name, optsOrBody, bodyOrTimeout, timeout);
  },
  coherent(response: string, claim: string): Promise<boolean> {
    return compositionRoot.coherentJudge().judgeCoherent(response, claim);
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
export type { RunOptions, TestBody };
export type { CrucibleErrorKind } from '../core/errors.js';
