import type { ExtractedValue, ExtractMode, ExtractType } from '../extract-type.js';
import type { RunResult, RunStatus } from '../run-result.js';
import type { ErrorRecord, ExtractionRecord, RunLedger, VerdictRecord } from '../state.js';
import { AssertionName } from './assertion-name.enum.js';

type NeutralCause = { name: string; message: string };

type NeutralJudged = { reasoning: string; response: string; facts?: string[] };

type NeutralCall =
  | { verdict: NeutralJudged & { claim: string; verdict: boolean } }
  | {
      extraction: NeutralJudged & {
        description: string;
        type: ExtractType;
        mode: ExtractMode;
        value: ExtractedValue;
      };
    }
  | { error: { cause: NeutralCause; attempts: number } };

type NeutralRunRecord = { status: RunStatus; cause?: NeutralCause; calls?: NeutralCall[] };

class NeutralRun {
  static cause(cause: NeutralCause | undefined): Error | undefined {
    if (cause === undefined) {
      return undefined;
    }
    const error = new Error(cause.message);
    error.name = cause.name;
    return error;
  }

  static result({ status, cause, calls = [] }: NeutralRunRecord): RunResult {
    return { status, cause: NeutralRun.cause(cause), context: NeutralRun.ledger(calls) };
  }

  static record(call: NeutralCall, seq: number): VerdictRecord | ExtractionRecord | ErrorRecord {
    if ('verdict' in call) {
      return { assertion: AssertionName.Coherent, facts: [], ...call.verdict, seq };
    }
    if ('extraction' in call) {
      return { assertion: AssertionName.Extract, facts: [], ...call.extraction, seq };
    }
    return { cause: NeutralRun.cause(call.error.cause), attempts: call.error.attempts, seq };
  }

  private static ledger(calls: NeutralCall[]): RunLedger {
    const ledger: RunLedger = { state: [], verdicts: [], extractions: [], errors: [] };
    calls.forEach((call, seq) => {
      if ('verdict' in call) {
        ledger.verdicts.push(NeutralRun.record(call, seq) as VerdictRecord);
      } else if ('extraction' in call) {
        ledger.extractions.push(NeutralRun.record(call, seq) as ExtractionRecord);
      } else {
        ledger.errors.push(NeutralRun.record(call, seq) as ErrorRecord);
      }
    });
    return ledger;
  }
}

export { NeutralRun };
export type { NeutralCall, NeutralCause, NeutralRunRecord };
