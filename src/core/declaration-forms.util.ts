import { CrucibleError } from './errors.js';
import type { GateBody } from './gate.js';
import { RunOptionsValidator } from './run-options-validator.util.js';
import type { RunOptions } from './run-options.js';

type TestDeclaration = { readonly opts: RunOptions; readonly body: GateBody };
type GroupBody = (...args: unknown[]) => unknown;
type GroupDeclaration = { readonly options: RunOptions; readonly callback: GroupBody };

class DeclarationForms {
  private readonly validator = new RunOptionsValidator();

  test(subject: string, args: readonly unknown[]): TestDeclaration {
    const { opts, body, rest } = this.split(subject, args);
    const [timeout, ...surplus] = rest;
    DeclarationForms.requireNothingAfter(subject, 'the timeout', surplus);
    if (timeout === undefined) {
      return { opts, body };
    }
    if (opts.testTimeout !== undefined) {
      throw new CrucibleError(
        'usage',
        `${subject} received both a trailing timeout and a testTimeout option; pass only one.`,
      );
    }
    const withTimeout = { ...opts, testTimeout: timeout };
    this.requireValid(subject, withTimeout);
    return { opts: withTimeout as RunOptions, body };
  }

  gate(subject: string, args: readonly unknown[]): TestDeclaration {
    const { opts, body, rest } = this.split(subject, args);
    DeclarationForms.requireNothingAfter(subject, 'the body', rest);
    return { opts, body };
  }

  group(subject: string, args: readonly unknown[]): GroupDeclaration {
    const [first, ...rest] = args;
    if (typeof first === 'function') {
      DeclarationForms.requireNothingAfter(subject, 'the callback', rest);
      return { options: {}, callback: first as GroupBody };
    }
    const [callback, ...surplus] = rest;
    if (typeof callback !== 'function') {
      throw new CrucibleError('usage', `${subject} needs a callback function.`);
    }
    DeclarationForms.requireNothingAfter(subject, 'the callback', surplus);
    this.requireValid(subject, first);
    return { options: { ...(first as RunOptions) }, callback: callback as GroupBody };
  }

  private split(
    subject: string,
    args: readonly unknown[],
  ): TestDeclaration & { readonly rest: unknown[] } {
    const [first, second, ...rest] = args;
    if (typeof first === 'function') {
      if (typeof second === 'function') {
        throw new CrucibleError(
          'usage',
          `${subject} received two bodies; pass options first, then the body.`,
        );
      }
      return { opts: {}, body: first as GateBody, rest: [second, ...rest] };
    }
    this.requireValid(subject, first);
    if (typeof second !== 'function') {
      throw new CrucibleError('usage', `${subject} needs a test body function.`);
    }
    return { opts: { ...(first as RunOptions) }, body: second as GateBody, rest };
  }

  private requireValid(subject: string, candidate: unknown): void {
    const violation = this.validator.violation(candidate, `${subject} options`);
    if (violation !== undefined) {
      throw new CrucibleError('usage', violation);
    }
  }

  private static requireNothingAfter(subject: string, last: string, surplus: unknown[]): void {
    if (surplus.some((extra) => extra !== undefined)) {
      throw new CrucibleError(
        'usage',
        `${subject} received an argument after ${last}; ${last} is the last argument.`,
      );
    }
  }
}

export { DeclarationForms };
export type { GroupBody, GroupDeclaration, TestDeclaration };
