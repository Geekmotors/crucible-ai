import { expect } from '@jest/globals';
import { CrucibleError } from '../errors.js';
import { Capture } from './capture.util.js';
import { CustomTimeout } from './custom-timeout.enum.js';
import { GroupBodyResult } from './group-body-result.enum.js';
import { InvalidDeclaration } from './invalid-declaration.enum.js';
import { InvalidTimeout } from './invalid-timeout.enum.js';
import { RunCount } from './run-count.enum.js';

class DeclarationFormsHarness {
  static body = (): void => {};
  static callback = (): void => {};
  static options = { runs: RunCount.Smaller };

  static invalidTests(): [InvalidDeclaration, unknown[]][] {
    const { body, options } = DeclarationFormsHarness;
    return [
      [InvalidDeclaration.NoArguments, []],
      [InvalidDeclaration.OptionsWithoutBody, [options]],
      [InvalidDeclaration.TwoBodies, [body, body]],
      [InvalidDeclaration.TimeoutInPlaceOfBody, [options, CustomTimeout.Short]],
      [InvalidDeclaration.InvalidTimeout, [body, InvalidTimeout.Zero]],
      [
        InvalidDeclaration.TimeoutAndTestTimeout,
        [{ testTimeout: CustomTimeout.Long }, body, CustomTimeout.Short],
      ],
      [InvalidDeclaration.ArgumentAfterTimeout, [body, CustomTimeout.Short, CustomTimeout.Long]],
      [InvalidDeclaration.TimeoutAfterEmptySlot, [body, undefined, CustomTimeout.Short]],
    ];
  }

  static invalidGates(): [InvalidDeclaration, unknown[]][] {
    const { body, options } = DeclarationFormsHarness;
    return [
      [InvalidDeclaration.NoArguments, []],
      [InvalidDeclaration.OptionsWithoutBody, [options]],
      [InvalidDeclaration.TwoBodies, [body, body]],
      [InvalidDeclaration.ArgumentAfterBody, [body, CustomTimeout.Short]],
      [InvalidDeclaration.ArgumentAfterTimeout, [options, body, CustomTimeout.Short]],
      [InvalidDeclaration.InvalidOptions, [{ runs: RunCount.Single - 1 }, body]],
    ];
  }

  static invalidGroups(): [InvalidDeclaration, unknown[]][] {
    const { callback, options } = DeclarationFormsHarness;
    return [
      [InvalidDeclaration.ArgumentAfterCallback, [callback, callback]],
      [InvalidDeclaration.ArgumentAfterCallback, [callback, undefined, callback]],
      [InvalidDeclaration.ArgumentAfterOptionsAndCallback, [options, callback, callback]],
      [InvalidDeclaration.NoArguments, []],
      [InvalidDeclaration.OptionsWithoutCallback, [options]],
      [InvalidDeclaration.TextInPlaceOfCallback, [options, GroupBodyResult.Value]],
      [InvalidDeclaration.ObjectInPlaceOfCallback, [options, {}]],
    ];
  }

  static kind(fn: () => unknown): string {
    const error = Capture.thrown(fn);
    expect(error).toBeInstanceOf(CrucibleError);
    return (error as CrucibleError).kind;
  }
}

export { DeclarationFormsHarness };
