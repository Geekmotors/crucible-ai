import { crucible } from 'crucible';
import type { RunContext, RunOptions } from 'crucible';
import { Gate } from './gate.enum.js';

class CrucibleVariantsTyping {
  private static NAME = 'types each supported variant';
  private static TIMEOUT = 60000;
  private static OPTIONS: RunOptions = { runs: Gate.Smoke, threshold: Gate.Smoke };
  private static ROWS: [number, string][] = [[2, 'two']];
  private static OBJECT_ROWS = [{ count: 2, word: 'two' }];
  private static VALUES = [2, 3];
  private static GROUP = (): void => {};

  itOnly(): void {
    crucible.it.only(CrucibleVariantsTyping.NAME, async (t) => {
      t.facts(CrucibleVariantsTyping.NAME);
    });
    crucible.it.only(
      CrucibleVariantsTyping.NAME,
      CrucibleVariantsTyping.OPTIONS,
      async () => {},
      CrucibleVariantsTyping.TIMEOUT,
    );
  }

  itSkip(): void {
    crucible.it.skip(CrucibleVariantsTyping.NAME, async () => {}, CrucibleVariantsTyping.TIMEOUT);
    crucible.it.skip(CrucibleVariantsTyping.NAME, CrucibleVariantsTyping.OPTIONS, async () => {});
  }

  itTodo(): void {
    crucible.it.todo(CrucibleVariantsTyping.NAME);
  }

  itEachWithTupleRows(): void {
    crucible.it.each(CrucibleVariantsTyping.ROWS)(
      '%i is %s',
      CrucibleVariantsTyping.OPTIONS,
      async (t: RunContext, count, word) => {
        const typedCount: number = count;
        const typedWord: string = word;
        t.facts(`${typedCount} ${typedWord}`);
      },
      CrucibleVariantsTyping.TIMEOUT,
    );
  }

  itEachWithInlineRows(): void {
    crucible.it.each([
      [1, true],
      [2, false],
    ])('%i', async (_t, count, flag) => {
      const typedCount: number = count;
      const typedFlag: boolean = flag;
      void typedCount;
      void typedFlag;
    });
  }

  itEachWithObjectRows(): void {
    crucible.it.each(CrucibleVariantsTyping.OBJECT_ROWS)('$word', async (_t, row) => {
      const typedCount: number = row.count;
      void typedCount;
    });
  }

  itEachWithValues(): void {
    crucible.it.each(CrucibleVariantsTyping.VALUES)('%i', async (_t, value) => {
      const typed: number = value;
      void typed;
    });
  }

  itOnlyEachAndSkipEach(): void {
    crucible.it.only.each(CrucibleVariantsTyping.ROWS)('%s', async (_t, count) => count);
    crucible.it.skip.each(CrucibleVariantsTyping.ROWS)('%s', async (_t, count) => count);
  }

  describeVariants(): void {
    crucible.describe.only(CrucibleVariantsTyping.NAME, CrucibleVariantsTyping.GROUP);
    crucible.describe.skip(
      CrucibleVariantsTyping.NAME,
      CrucibleVariantsTyping.OPTIONS,
      CrucibleVariantsTyping.GROUP,
    );
  }

  describeEach(): void {
    crucible.describe.each(CrucibleVariantsTyping.ROWS)(
      '%s',
      CrucibleVariantsTyping.OPTIONS,
      (count, word) => {
        const typedCount: number = count;
        const typedWord: string = word;
        void typedCount;
        void typedWord;
      },
    );
    crucible.describe.only.each(CrucibleVariantsTyping.OBJECT_ROWS)('$word', (row) => {
      const typedWord: string = row.word;
      void typedWord;
    });
    crucible.describe.skip.each(CrucibleVariantsTyping.VALUES)('%i', (value) => {
      const typed: number = value;
      void typed;
    });
  }

  eachWithTaggedTemplate(): void {
    const { ROWS } = CrucibleVariantsTyping;
    crucible.it.each`
      count             | word
      ${ROWS[0]?.[0]}   | ${ROWS[0]?.[1]}
    `('$word', async (_t, row) => {
      const typed: Record<string, unknown> = row;
      void typed;
    });
    crucible.describe.each`
      count             | word
      ${ROWS[0]?.[0]}   | ${ROWS[0]?.[1]}
    `('$word', CrucibleVariantsTyping.OPTIONS, (row) => {
      const typed: Record<string, unknown> = row;
      void typed;
    });
  }

  describeEachWithWronglyTypedRow(): void {
    crucible.describe.each(CrucibleVariantsTyping.ROWS)(
      '%s',
      // @ts-expect-error the first row value is a number
      (count: string) => {
        void count;
      },
    );
  }

  describeWithoutVariants(): void {
    // @ts-expect-error describe has no todo
    crucible.describe.todo(CrucibleVariantsTyping.NAME);
    // @ts-expect-error describe has no concurrent
    crucible.describe.concurrent(CrucibleVariantsTyping.NAME, CrucibleVariantsTyping.GROUP);
  }

  itEachWithWronglyTypedRow(): void {
    crucible.it.each(CrucibleVariantsTyping.ROWS)(
      '%s',
      // @ts-expect-error the first row value is a number
      async (_t: RunContext, count: string) => count,
    );
  }

  itEachWithoutBody(): void {
    // @ts-expect-error a row test needs a body
    crucible.it.each(CrucibleVariantsTyping.ROWS)('%s', CrucibleVariantsTyping.OPTIONS);
  }

  itOnlyWithoutBody(): void {
    // @ts-expect-error a focused test needs a body
    crucible.it.only(CrucibleVariantsTyping.NAME, CrucibleVariantsTyping.OPTIONS);
  }

  itSkipWithTwoBodies(): void {
    const body = async (): Promise<void> => {};
    // @ts-expect-error a second body in place of the timeout is rejected
    crucible.it.skip(CrucibleVariantsTyping.NAME, body, body);
  }

  itTodoWithBody(): void {
    // @ts-expect-error todo takes a name only
    crucible.it.todo(CrucibleVariantsTyping.NAME, async () => {});
  }

  itEachWithUnknownOption(): void {
    // @ts-expect-error variant options are run options
    crucible.it.each(CrucibleVariantsTyping.ROWS)('%s', { retries: Gate.Smoke }, async () => {});
  }

  describeEachWithTimeout(): void {
    const { ROWS, GROUP, TIMEOUT } = CrucibleVariantsTyping;
    // @ts-expect-error describe takes no timeout argument
    crucible.describe.each(ROWS)('%s', GROUP, TIMEOUT);
  }

  blockedFailing(): void {
    // @ts-expect-error failing is not supported
    crucible.it.failing(CrucibleVariantsTyping.NAME, async () => {});
  }

  blockedConcurrent(): void {
    // @ts-expect-error concurrent is not supported
    crucible.it.concurrent(CrucibleVariantsTyping.NAME, async () => {});
  }

  blockedChain(): void {
    // @ts-expect-error each is the only variant of a focused test
    crucible.it.only.skip(CrucibleVariantsTyping.NAME, async () => {});
  }

  replacedVariant(): void {
    // @ts-expect-error variants cannot be reassigned
    crucible.it.only = crucible.it.skip;
  }
}

export { CrucibleVariantsTyping };
