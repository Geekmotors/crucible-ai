import { describe, expect, it } from '@jest/globals';
import { DeclarationForms } from './declaration-forms.util.js';
import { CustomTimeout } from './test/custom-timeout.enum.js';
import { DeclarationFormsHarness } from './test/declaration-forms-harness.util.js';
import { DeclarationSubject } from './test/declaration-subject.enum.js';
import { RunCount } from './test/run-count.enum.js';

describe('DeclarationForms — tests', () => {
  const forms = new DeclarationForms();
  const { body, options } = DeclarationFormsHarness;

  it.each<[string, unknown[], object]>([
    ['a body', [body], {}],
    ['a body and a timeout', [body, CustomTimeout.Short], { testTimeout: CustomTimeout.Short }],
    ['options and a body', [options, body], options],
    [
      'options, a body and a timeout',
      [options, body, CustomTimeout.Short],
      { ...options, testTimeout: CustomTimeout.Short },
    ],
    ['a body and an undefined timeout', [body, undefined], {}],
  ])('accepts %s', (_label, args, expected) => {
    expect(forms.test(DeclarationSubject.It, args).opts).toEqual(expected);
  });

  it.each(DeclarationFormsHarness.invalidTests())('rejects %s as usage', (_label, args) => {
    expect(DeclarationFormsHarness.kind(() => forms.test(DeclarationSubject.It, args))).toBe(
      'usage',
    );
  });

  it('copies the options so later changes to them have no effect', () => {
    const own = { runs: RunCount.Smaller };
    const declared = forms.test(DeclarationSubject.It, [own, body]);
    own.runs = RunCount.Gated;
    expect(declared.opts).toEqual({ runs: RunCount.Smaller });
  });
});

describe('DeclarationForms — gated bodies', () => {
  const forms = new DeclarationForms();
  const { body, options } = DeclarationFormsHarness;

  it.each<[string, unknown[], object]>([
    ['a body', [body], {}],
    ['options and a body', [options, body], options],
    ['a body and an empty slot', [body, undefined], {}],
  ])('accepts %s', (_label, args, expected) => {
    expect(forms.gate(DeclarationSubject.Gate, args).opts).toEqual(expected);
  });

  it.each(DeclarationFormsHarness.invalidGates())('rejects %s as usage', (_label, args) => {
    expect(DeclarationFormsHarness.kind(() => forms.gate(DeclarationSubject.Gate, args))).toBe(
      'usage',
    );
  });
});

describe('DeclarationForms — groups', () => {
  const forms = new DeclarationForms();
  const { callback, options } = DeclarationFormsHarness;

  it.each<[string, unknown[], unknown]>([
    ['a callback', [callback], {}],
    ['options and a callback', [options, callback], options],
  ])('accepts %s', (_label, args, expected) => {
    expect(forms.group(DeclarationSubject.Describe, args).options).toEqual(expected);
  });

  it.each(DeclarationFormsHarness.invalidGroups())('rejects %s as usage', (_label, args) => {
    expect(DeclarationFormsHarness.kind(() => forms.group(DeclarationSubject.Describe, args))).toBe(
      'usage',
    );
  });
});
