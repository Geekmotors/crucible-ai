import { crucible } from 'crucible-ai';
import type { RunOptions, TestBody } from 'crucible-ai';
import { Gate } from './gate.enum.js';

class CrucibleItTyping {
  private static NAME = 'types each supported form';
  private static TIMEOUT = 60000;
  private static OPTIONS: RunOptions = { runs: Gate.Smoke };
  private static BODY: TestBody = async () => {};

  withBody(): void {
    crucible.it(CrucibleItTyping.NAME, CrucibleItTyping.BODY);
  }

  withBodyAndTimeout(): void {
    crucible.it(CrucibleItTyping.NAME, CrucibleItTyping.BODY, CrucibleItTyping.TIMEOUT);
  }

  withOptionsAndBody(): void {
    crucible.it(CrucibleItTyping.NAME, CrucibleItTyping.OPTIONS, CrucibleItTyping.BODY);
  }

  withOptionsBodyAndTimeout(): void {
    crucible.it(
      CrucibleItTyping.NAME,
      CrucibleItTyping.OPTIONS,
      CrucibleItTyping.BODY,
      CrucibleItTyping.TIMEOUT,
    );
  }

  withForwardedOptionalTimeout(timeout?: number): void {
    crucible.it(CrucibleItTyping.NAME, CrucibleItTyping.BODY, timeout);
  }

  withOptionsAndForwardedOptionalTimeout(timeout?: number): void {
    crucible.it(CrucibleItTyping.NAME, CrucibleItTyping.OPTIONS, CrucibleItTyping.BODY, timeout);
  }

  withReplacedIt(): void {
    // @ts-expect-error the frozen surface cannot be reassigned
    crucible.it = CrucibleItTyping.BODY;
  }

  withOptionsOnly(): void {
    // @ts-expect-error a test without a body is rejected at compile time
    crucible.it(CrucibleItTyping.NAME, CrucibleItTyping.OPTIONS);
  }

  withTwoBodies(): void {
    // @ts-expect-error a second body in place of the timeout is rejected at compile time
    crucible.it(CrucibleItTyping.NAME, CrucibleItTyping.BODY, CrucibleItTyping.BODY);
  }

  withTimeoutBeforeBody(): void {
    // @ts-expect-error a timeout before the body is rejected at compile time
    crucible.it(CrucibleItTyping.NAME, CrucibleItTyping.TIMEOUT, CrucibleItTyping.BODY);
  }
}

export { CrucibleItTyping };
