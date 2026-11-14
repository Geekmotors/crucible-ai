import { it } from '@jest/globals';
import { crucible } from 'crucible-ai';
import type { RunContext, RunOptions, TestBody } from 'crucible-ai';
import { Gate } from './gate.enum.js';

class CrucibleGateTyping {
  private static NAME = 'types each supported gate form';
  private static TIMEOUT = 60000;
  private static OPTIONS: RunOptions = { runs: Gate.Smoke, threshold: Gate.Smoke };
  private static RESPONSE = 'Two apples.';
  private static CLAIM = 'The reply names a number of apples.';
  private static ROWS: [number, string][] = [[2, 'two']];

  gateWithBody(): void {
    it(
      CrucibleGateTyping.NAME,
      crucible.gate(async (t) => {
        t.facts(CrucibleGateTyping.RESPONSE);
      }),
      CrucibleGateTyping.TIMEOUT,
    );
  }

  gateWithOptions(): void {
    it(
      CrucibleGateTyping.NAME,
      crucible.gate(CrucibleGateTyping.OPTIONS, async (t) => {
        const verdict: boolean = await t.coherent(
          CrucibleGateTyping.RESPONSE,
          CrucibleGateTyping.CLAIM,
        );
        const count: number | null = await t.extract(
          CrucibleGateTyping.RESPONSE,
          CrucibleGateTyping.CLAIM,
          { as: 'number' },
        );
        void verdict;
        void count;
      }),
    );
  }

  gateWithTypedRowParameters(): void {
    it.each(CrucibleGateTyping.ROWS)(
      CrucibleGateTyping.NAME,
      crucible.gate(
        CrucibleGateTyping.OPTIONS,
        async (t: RunContext, count: number, word: string) => {
          t.facts(`${count} is ${word}`);
        },
      ),
    );
  }

  gateWithUntypedRow(): void {
    it.each(CrucibleGateTyping.ROWS)(
      CrucibleGateTyping.NAME,
      crucible.gate(async (t, ...row) => {
        const first: unknown = row[0];
        t.facts(String(first));
      }),
    );
  }

  gateWithUntypedRowOutsideATable(): void {
    const test = crucible.gate(async (t, ...row) => {
      const first: unknown = row[0];
      t.facts(String(first));
    });
    it(CrucibleGateTyping.NAME, test, CrucibleGateTyping.TIMEOUT);
  }

  gateOnTheRunnerTest(): void {
    it.only(
      CrucibleGateTyping.NAME,
      crucible.gate(async () => {}),
    );
  }

  gateWithoutBody(): void {
    // @ts-expect-error the gate needs a body
    crucible.gate(CrucibleGateTyping.OPTIONS);
  }

  gateWithUnknownOption(): void {
    // @ts-expect-error gate options are run options
    crucible.gate({ retries: Gate.Smoke }, async () => {});
  }

  gateWithRowParametersOnAPlainTest(): void {
    it(
      CrucibleGateTyping.NAME,
      // @ts-expect-error a plain test passes no row values
      crucible.gate(async (_t: RunContext, count: number) => count),
    );
  }

  itBodyReceivesTheRunContext(): void {
    crucible.it(CrucibleGateTyping.NAME, CrucibleGateTyping.OPTIONS, async (t) => {
      t.facts(CrucibleGateTyping.RESPONSE);
      const verdict: boolean = await t.coherent(
        CrucibleGateTyping.RESPONSE,
        CrucibleGateTyping.CLAIM,
      );
      void verdict;
    });
  }

  itBodyWithoutArguments(): void {
    const body: TestBody = async () => {};
    crucible.it(CrucibleGateTyping.NAME, body);
  }

  runContextFactsAreStrings(t: RunContext): void {
    // @ts-expect-error facts are strings
    t.facts(42);
  }
}

export { CrucibleGateTyping };
