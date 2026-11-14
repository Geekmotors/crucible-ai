import { CrucibleError } from './errors.js';
import type { ExtractedValue, ExtractMode, ExtractOptions, ExtractType } from './extract-type.js';
import { JudgeExchange } from './judge-exchange.js';
import type { SchemaTextSupplier } from './judge-exchange.js';
import { PayloadAssembler } from './payload-assembler.util.js';
import { RunScope, runScope } from './state.js';
import { TraceReporter } from './trace-reporter.js';

type ExtractRequest = {
  readonly type: ExtractType;
  readonly strict?: boolean;
};

type ParsedExtraction = {
  readonly value: ExtractedValue;
  readonly reasoning: string;
};

class Extractor {
  private static readonly ASSERTION = 'extract';
  private static readonly CONTRACT = '{ "value": <requested type> | null, "reasoning": string }';
  private static readonly TYPES: readonly ExtractType[] = ['string', 'number', 'boolean'];
  private static readonly DEFAULT_TYPE: ExtractType = 'string';
  private static readonly OPTION_KEYS: ReadonlySet<string> = new Set(['as', 'strict']);

  private readonly assembler = new PayloadAssembler();

  constructor(
    private readonly schemaText: SchemaTextSupplier,
    private readonly exchange: JudgeExchange,
    private readonly scope: RunScope = runScope,
    private readonly trace: TraceReporter = new TraceReporter(),
  ) {}

  async extract(
    text: string,
    description: string,
    options?: ExtractOptions,
  ): Promise<ExtractedValue> {
    const { type, strict } = this.requested(text, description, options);
    const mode = this.modeFor(strict ?? this.scope.strict());
    const state = this.scope.context().state;
    const parsed = await this.exchange.ask({
      system: this.schemaText(),
      prompt: this.assembler.assemble(state, [
        { header: 'RESPONSE', content: text },
        { header: 'TARGET', content: description },
        { header: 'TYPE', content: type },
        { header: 'MODE', content: mode },
      ]),
      contract: Extractor.CONTRACT,
      read: (reply) => this.extraction(reply, type),
    });
    const record = this.scope.recordExtraction({
      assertion: Extractor.ASSERTION,
      description,
      type,
      mode,
      value: parsed.value,
      reasoning: parsed.reasoning,
      response: text,
    });
    this.trace.judgeRecorded(record);
    return parsed.value;
  }

  private modeFor(strict: boolean): ExtractMode {
    return strict ? 'strict' : 'lenient';
  }

  private requested(text: unknown, description: unknown, options: unknown): ExtractRequest {
    if (typeof text !== 'string' || typeof description !== 'string') {
      throw new CrucibleError(
        'usage',
        'crucible.extract needs a string text and a string description.',
      );
    }
    if (options === undefined) {
      return { type: Extractor.DEFAULT_TYPE };
    }
    if (typeof options !== 'object' || options === null || Array.isArray(options)) {
      throw this.badOptions();
    }
    if (Object.keys(options).some((key) => !Extractor.OPTION_KEYS.has(key))) {
      throw this.badOptions();
    }
    const { as: requested, strict } = options as { as?: unknown; strict?: unknown };
    const type = requested === undefined ? Extractor.DEFAULT_TYPE : requested;
    if (!Extractor.TYPES.some((known) => known === type)) {
      throw this.badOptions();
    }
    if (strict !== undefined && typeof strict !== 'boolean') {
      throw this.badOptions();
    }
    return { type: type as ExtractType, strict };
  }

  private badOptions(): CrucibleError {
    return new CrucibleError(
      'usage',
      `crucible.extract options take { as?: ${Extractor.TYPES.map((type) => `'${type}'`).join(' | ')}, strict?: boolean }.`,
    );
  }

  private extraction(reply: unknown, type: ExtractType): ParsedExtraction | undefined {
    if (typeof reply !== 'object' || reply === null || !('value' in reply)) {
      return undefined;
    }
    const { value, reasoning } = reply as { value: unknown; reasoning?: unknown };
    if (typeof reasoning !== 'string' || !this.matches(value, type)) {
      return undefined;
    }
    return { value: value as ExtractedValue, reasoning };
  }

  private matches(value: unknown, type: ExtractType): boolean {
    if (value === null) {
      return true;
    }
    if (typeof value !== type) {
      return false;
    }
    return type !== 'number' || Number.isFinite(value);
  }
}

export { Extractor };
