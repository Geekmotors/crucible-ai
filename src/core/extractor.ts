import { CrucibleError } from './errors.js';
import type { ExtractedValue, ExtractMode, ExtractOptions, ExtractType } from './extract-type.js';
import { FactList } from './fact-list.util.js';
import { JudgeExchange } from './judge-exchange.js';
import { OptionBag } from './option-bag.util.js';
import type { SchemaTextSupplier } from './judge-exchange.js';
import { PayloadAssembler } from './payload-assembler.util.js';
import { RunScope, runScope } from './state.js';
import { TraceReporter } from './trace-reporter.js';

type ExtractRequest = {
  readonly type: ExtractType;
  readonly strict?: boolean;
  readonly facts: readonly string[];
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
  private static readonly OPTION_KEYS: ReadonlySet<string> = new Set(['as', 'strict', 'facts']);

  private readonly assembler = new PayloadAssembler();
  private readonly factList = new FactList();
  private readonly optionBag = new OptionBag();

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
    const { type, strict, facts: callFacts } = this.requested(text, description, options);
    const mode = this.modeFor(strict ?? this.scope.strict());
    const facts = [...this.scope.context().state, ...callFacts];
    const parsed = await this.exchange.ask({
      system: this.schemaText(),
      prompt: this.assembler.assemble(facts, [
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
      facts,
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
      return { type: Extractor.DEFAULT_TYPE, facts: [] };
    }
    if (!this.optionBag.accepts(options, Extractor.OPTION_KEYS)) {
      throw this.badOptions();
    }
    const { as: requested, strict, facts } = options;
    const type = requested === undefined ? Extractor.DEFAULT_TYPE : requested;
    if (!Extractor.TYPES.some((known) => known === type)) {
      throw this.badOptions();
    }
    if (strict !== undefined && typeof strict !== 'boolean') {
      throw this.badOptions();
    }
    return { type: type as ExtractType, strict, facts: this.factList.optional(facts) };
  }

  private badOptions(): CrucibleError {
    return new CrucibleError(
      'usage',
      `crucible.extract options take { as?: ${Extractor.TYPES.map((type) => `'${type}'`).join(' | ')}, strict?: boolean, facts?: string | string[] }.`,
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
