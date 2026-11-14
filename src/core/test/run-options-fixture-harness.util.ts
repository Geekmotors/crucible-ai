import { DeclarationForms } from '../declaration-forms.util.js';
import type { ResolvedRunOptions, RunOptions } from '../run-options.js';
import { TestModel } from '../../providers/test/test-model.enum.js';
import { ConfigHarness } from './config-harness.util.js';
import { DeclarationFormsHarness } from './declaration-forms-harness.util.js';
import { DeclarationSubject } from './declaration-subject.enum.js';
import { ExtractModeName } from './extract-mode-name.enum.js';
import { ExtractorHarness } from './extractor-harness.util.js';
import { FixtureOutcome } from './fixture-outcome.util.js';
import type { ObservedOutcome } from './fixture-outcome.util.js';
import { GroupSettingsHarness } from './group-settings-harness.util.js';
import { SpecialValue } from './special-value.util.js';

type ResolveLayers = {
  testDefaults?: RunOptions;
  groups?: RunOptions[];
  test?: RunOptions;
  call?: { strict?: boolean };
};

type ValidationSource = 'test' | 'group' | 'config';

type ValidateInput = { source: ValidationSource; options: unknown };

class RunOptionsFixtureHarness {
  private static accepting: Record<ValidationSource, (options: unknown) => unknown> = {
    test: (options) =>
      new DeclarationForms().test(DeclarationSubject.It, [options, DeclarationFormsHarness.body])
        .opts,
    group: (options) =>
      new DeclarationForms().group(DeclarationSubject.Describe, [
        options,
        DeclarationFormsHarness.callback,
      ]).options,
    config: (options) =>
      ConfigHarness.store({
        provider: 'fake',
        model: TestModel.Generic,
        testDefaults: options,
      }).get().testDefaults,
  };

  static resolve(input: unknown): Promise<ObservedOutcome> {
    const layers = SpecialValue.decode(input) as ResolveLayers;
    return FixtureOutcome.settled(() => RunOptionsFixtureHarness.resolved(layers));
  }

  static validate(input: unknown): Promise<ObservedOutcome> {
    const { source, options } = SpecialValue.decode(input) as ValidateInput;
    return FixtureOutcome.settled(() => RunOptionsFixtureHarness.accepting[source](options));
  }

  private static async resolved(layers: ResolveLayers): Promise<ResolvedRunOptions> {
    const resolved = RunOptionsFixtureHarness.withinGroups(
      new GroupSettingsHarness(),
      layers.groups ?? [],
      layers,
    );
    if (layers.call === undefined) {
      return resolved;
    }
    const context = await ExtractorHarness.leaningContext(
      { ...layers.call, as: 'number' },
      resolved.strict,
    );
    return { ...resolved, strict: context.extractions[0]?.mode === ExtractModeName.Strict };
  }

  private static withinGroups(
    harness: GroupSettingsHarness,
    groups: RunOptions[],
    layers: ResolveLayers,
  ): ResolvedRunOptions {
    const [outer, ...inner] = groups;
    if (outer === undefined) {
      return harness.resolve(layers.test, layers.testDefaults);
    }
    let resolved: ResolvedRunOptions | undefined;
    harness.within(outer, () => {
      resolved = RunOptionsFixtureHarness.withinGroups(harness, inner, layers);
    });
    return resolved as ResolvedRunOptions;
  }
}

export { RunOptionsFixtureHarness };
