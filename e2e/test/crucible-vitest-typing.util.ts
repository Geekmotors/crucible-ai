import { test } from 'vitest';
import { crucible, CrucibleError } from 'crucible-ai/vitest';
import type { CrucibleDescribe, CrucibleIt, RunContext, RunOptions } from 'crucible-ai/vitest';
import { Gate } from './gate.enum.js';

class CrucibleVitestTyping {
  private static NAME = 'types each Vitest variant';
  private static TIMEOUT = 60000;
  private static OPTIONS: RunOptions = { runs: Gate.Smoke, threshold: Gate.Smoke };
  private static ROWS: [number, string][] = [[2, 'two']];
  private static OBJECT_ROWS = [{ count: 2, word: 'two' }];
  private static GROUP = (): void => {};

  sameApiAsTheRoot(): void {
    const it: CrucibleIt = crucible.it;
    const group: CrucibleDescribe = crucible.describe;
    void it;
    void group;
    void CrucibleError;
    crucible.it(CrucibleVitestTyping.NAME, async (t) => {
      t.facts(CrucibleVitestTyping.NAME);
      await t.coherent(CrucibleVitestTyping.NAME, CrucibleVitestTyping.NAME);
    });
    crucible.it(
      CrucibleVitestTyping.NAME,
      CrucibleVitestTyping.OPTIONS,
      async () => {},
      CrucibleVitestTyping.TIMEOUT,
    );
    crucible.describe(CrucibleVitestTyping.NAME, CrucibleVitestTyping.OPTIONS, () => {});
  }

  itFor(): void {
    crucible.it.for(CrucibleVitestTyping.ROWS)(
      '%i is %s',
      CrucibleVitestTyping.OPTIONS,
      async (t: RunContext, [count, word]) => {
        const typedCount: number = count;
        const typedWord: string = word;
        t.facts(`${typedCount} ${typedWord}`);
      },
      CrucibleVitestTyping.TIMEOUT,
    );
    crucible.it.only.for(CrucibleVitestTyping.OBJECT_ROWS)('$word', async (_t, row) => {
      const typed: number = row.count;
      void typed;
    });
    crucible.it.skip.for(CrucibleVitestTyping.ROWS)('%s', async () => {});
  }

  itEach(): void {
    crucible.it.each(CrucibleVitestTyping.ROWS)('%s', async (_t, count, word) => {
      const typedCount: number = count;
      const typedWord: string = word;
      void typedCount;
      void typedWord;
    });
    crucible.it.only.each(CrucibleVitestTyping.ROWS)('%s', async () => {});
  }

  itConditions(): void {
    crucible.it.skipIf(true)(CrucibleVitestTyping.NAME, async (t) => {
      t.facts(CrucibleVitestTyping.NAME);
    });
    crucible.it.runIf(false)(
      CrucibleVitestTyping.NAME,
      CrucibleVitestTyping.OPTIONS,
      async () => {},
      CrucibleVitestTyping.TIMEOUT,
    );
    crucible.it.todo(CrucibleVitestTyping.NAME);
  }

  describeVariants(): void {
    crucible.describe.todo(CrucibleVitestTyping.NAME);
    crucible.describe.skipIf(true)(CrucibleVitestTyping.NAME, CrucibleVitestTyping.GROUP);
    crucible.describe.runIf(true)(
      CrucibleVitestTyping.NAME,
      CrucibleVitestTyping.OPTIONS,
      CrucibleVitestTyping.GROUP,
    );
    crucible.describe.for(CrucibleVitestTyping.ROWS)('%s', ([count, word]) => {
      const typedCount: number = count;
      const typedWord: string = word;
      void typedCount;
      void typedWord;
    });
    crucible.describe.only.each(CrucibleVitestTyping.ROWS)('%s', (count) => {
      const typed: number = count;
      void typed;
    });
  }

  gateOnVitestTest(): void {
    test(
      CrucibleVitestTyping.NAME,
      crucible.gate(CrucibleVitestTyping.OPTIONS, async (t) => {
        t.facts(CrucibleVitestTyping.NAME);
      }),
      CrucibleVitestTyping.TIMEOUT,
    );
  }

  blockedVariants(): void {
    // @ts-expect-error fails is not supported
    crucible.it.fails(CrucibleVitestTyping.NAME, async () => {});
    // @ts-expect-error concurrent is not supported
    crucible.it.concurrent(CrucibleVitestTyping.NAME, async () => {});
    // @ts-expect-error describe.shuffle is not supported
    crucible.describe.shuffle(CrucibleVitestTyping.NAME, CrucibleVitestTyping.GROUP);
    // @ts-expect-error describe.concurrent is not supported
    crucible.describe.concurrent(CrucibleVitestTyping.NAME, CrucibleVitestTyping.GROUP);
    // @ts-expect-error describe.sequential is not supported
    crucible.describe.sequential(CrucibleVitestTyping.NAME, CrucibleVitestTyping.GROUP);
    // @ts-expect-error skipIf returns a plain registrar without tables
    crucible.it.skipIf(false).each(CrucibleVitestTyping.ROWS);
    // @ts-expect-error tables come after a modifier, never before
    void crucible.it.each(CrucibleVitestTyping.ROWS).only;
  }

  forRowIsNotSpread(): void {
    crucible.it.for(CrucibleVitestTyping.ROWS)(
      '%s',
      // @ts-expect-error the row arrives whole, not spread
      async (_t: RunContext, count: number) => count,
    );
  }

  readonlyApi(): void {
    // @ts-expect-error crucible is readonly
    crucible.describe = crucible.it;
  }
}

export { CrucibleVitestTyping };
