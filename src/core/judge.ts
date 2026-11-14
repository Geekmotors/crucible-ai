import type { CoherentOptions } from './assertion-options.js';
import { CrucibleError } from './errors.js';
import { FactList } from './fact-list.util.js';
import { JudgeExchange } from './judge-exchange.js';
import { OptionBag } from './option-bag.util.js';
import type { SchemaTextSupplier } from './judge-exchange.js';
import { PayloadAssembler } from './payload-assembler.util.js';
import { RunScope, runScope } from './state.js';
import { TraceReporter } from './trace-reporter.js';

type ParsedVerdict = {
  readonly verdict: boolean;
  readonly reasoning: string;
};

class Judge {
  private static readonly ASSERTION = 'coherent';
  private static readonly CONTRACT = '{ "verdict": boolean, "reasoning": string }';
  private static readonly OPTION_KEYS: ReadonlySet<string> = new Set(['facts']);

  private readonly assembler = new PayloadAssembler();
  private readonly factList = new FactList();
  private readonly optionBag = new OptionBag();

  constructor(
    private readonly schemaText: SchemaTextSupplier,
    private readonly exchange: JudgeExchange,
    private readonly scope: RunScope = runScope,
    private readonly trace: TraceReporter = new TraceReporter(),
  ) {}

  async judgeCoherent(
    response: string,
    claim: string,
    options?: CoherentOptions,
  ): Promise<boolean> {
    this.requireStrings(response, claim);
    const callFacts = this.callFacts(options);
    const facts = [...this.scope.context().state, ...callFacts];
    const parsed = await this.exchange.ask({
      system: this.schemaText(),
      prompt: this.assembler.assemble(facts, [
        { header: 'RESPONSE', content: response },
        { header: 'CLAIM', content: claim },
      ]),
      contract: Judge.CONTRACT,
      read: (reply) => this.verdict(reply),
    });
    const record = this.scope.recordVerdict({
      assertion: Judge.ASSERTION,
      claim,
      verdict: parsed.verdict,
      reasoning: parsed.reasoning,
      response,
      facts,
    });
    this.trace.judgeRecorded(record);
    return parsed.verdict;
  }

  private requireStrings(response: unknown, claim: unknown): void {
    if (typeof response !== 'string' || typeof claim !== 'string') {
      throw new CrucibleError(
        'usage',
        'crucible.coherent needs a string actual and a string expectation.',
      );
    }
  }

  private callFacts(options: unknown): string[] {
    if (options === undefined) {
      return [];
    }
    if (!this.optionBag.accepts(options, Judge.OPTION_KEYS)) {
      throw new CrucibleError(
        'usage',
        'crucible.coherent options take { facts?: string | string[] }.',
      );
    }
    return this.factList.optional(options.facts);
  }

  private verdict(reply: unknown): ParsedVerdict | undefined {
    const verdict = (reply as { verdict?: unknown } | null)?.verdict;
    const reasoning = (reply as { reasoning?: unknown } | null)?.reasoning;
    if (typeof verdict === 'boolean' && typeof reasoning === 'string') {
      return { verdict, reasoning };
    }
    return undefined;
  }
}

export { Judge };
