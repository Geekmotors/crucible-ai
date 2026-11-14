import { crucible } from 'crucible-ai';
import type { CoherentOptions } from 'crucible-ai';

class CrucibleFactsTyping {
  private static RESPONSE = 'Your meeting is in room C3.';
  private static CLAIM = 'The reply names the meeting room.';
  private static FACT = 'The meeting is in room C3.';
  private static LOGS: string[] = ['The meeting moved to room C3.', 'The user asked where.'];

  addsOneFact(): void {
    crucible.facts(CrucibleFactsTyping.FACT);
  }

  addsTheSystemLogs(): void {
    crucible.facts(CrucibleFactsTyping.LOGS);
  }

  keepsTheDeprecatedAliases(): void {
    crucible.load(CrucibleFactsTyping.FACT);
    crucible.append(CrucibleFactsTyping.LOGS);
  }

  rejectsANonStringFact(): void {
    // @ts-expect-error facts are strings
    crucible.facts(42);
  }

  coherentWithoutOptions(): Promise<boolean> {
    return crucible.coherent(CrucibleFactsTyping.RESPONSE, CrucibleFactsTyping.CLAIM);
  }

  coherentWithFacts(): Promise<boolean> {
    return crucible.coherent(CrucibleFactsTyping.RESPONSE, CrucibleFactsTyping.CLAIM, {
      facts: CrucibleFactsTyping.LOGS,
    });
  }

  coherentWithTypedOptions(options: CoherentOptions): Promise<boolean> {
    return crucible.coherent(CrucibleFactsTyping.RESPONSE, CrucibleFactsTyping.CLAIM, options);
  }

  coherentWithUnknownOption(): Promise<boolean> {
    return crucible.coherent(CrucibleFactsTyping.RESPONSE, CrucibleFactsTyping.CLAIM, {
      // @ts-expect-error coherent options take facts only
      strict: true,
    });
  }

  coherentWithNonStringFacts(): Promise<boolean> {
    return crucible.coherent(CrucibleFactsTyping.RESPONSE, CrucibleFactsTyping.CLAIM, {
      // @ts-expect-error facts are strings
      facts: [42],
    });
  }
}

export { CrucibleFactsTyping };
