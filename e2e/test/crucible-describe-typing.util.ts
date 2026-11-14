import { crucible } from 'crucible';
import type { RunOptions } from 'crucible';
import { Gate } from './gate.enum.js';

class CrucibleDescribeTyping {
  private static NAME = 'types each supported describe form';
  private static OPTIONS: RunOptions = { runs: Gate.Smoke };
  private static GROUP = (): void => {};

  withCallback(): void {
    crucible.describe(CrucibleDescribeTyping.NAME, CrucibleDescribeTyping.GROUP);
  }

  withOptionsAndCallback(): void {
    crucible.describe(
      CrucibleDescribeTyping.NAME,
      CrucibleDescribeTyping.OPTIONS,
      CrucibleDescribeTyping.GROUP,
    );
  }

  withInlineOptions(): void {
    crucible.describe(CrucibleDescribeTyping.NAME, { threshold: Gate.Threshold }, () => {
      crucible.it(CrucibleDescribeTyping.NAME, async () => {});
    });
  }

  withStrictGroup(): void {
    crucible.describe(CrucibleDescribeTyping.NAME, { strict: true }, () => {
      crucible.it(CrucibleDescribeTyping.NAME, { strict: false }, async () => {});
    });
  }

  withNonBooleanStrict(): void {
    // @ts-expect-error strict is a boolean, never coerced
    crucible.describe(CrucibleDescribeTyping.NAME, { strict: 'yes' }, CrucibleDescribeTyping.GROUP);
  }

  withReplacedDescribe(): void {
    // @ts-expect-error the frozen surface cannot be reassigned
    crucible.describe = CrucibleDescribeTyping.GROUP;
  }

  withOptionsOnly(): void {
    // @ts-expect-error a group without a callback is rejected at compile time
    crucible.describe(CrucibleDescribeTyping.NAME, CrucibleDescribeTyping.OPTIONS);
  }

  withNameOnly(): void {
    // @ts-expect-error a group without a callback is rejected at compile time
    crucible.describe(CrucibleDescribeTyping.NAME);
  }

  withUnknownOption(): void {
    const { NAME, GROUP } = CrucibleDescribeTyping;
    // @ts-expect-error an unknown option is rejected at compile time
    crucible.describe(NAME, { run: Gate.Smoke }, GROUP);
  }

  withCallbackBeforeOptions(): void {
    const { NAME, GROUP, OPTIONS } = CrucibleDescribeTyping;
    // @ts-expect-error options after the callback are rejected at compile time
    crucible.describe(NAME, GROUP, OPTIONS);
  }

  withTimeoutArgument(): void {
    // @ts-expect-error describe takes no timeout argument
    crucible.describe(CrucibleDescribeTyping.NAME, CrucibleDescribeTyping.GROUP, Gate.Smoke);
  }
}

export { CrucibleDescribeTyping };
