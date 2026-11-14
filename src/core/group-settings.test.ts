import { describe, expect, it } from '@jest/globals';
import type { ResolvedRunOptions } from './run-options.js';
import { CustomTimeout } from './test/custom-timeout.enum.js';
import { GroupSettingsHarness } from './test/group-settings-harness.util.js';
import { GroupBodyResult } from './test/group-body-result.enum.js';
import { InferenceTimeout } from './test/inference-timeout.enum.js';
import { InvalidTestDefault } from './test/invalid-test-default.enum.js';
import { InvalidTimeout } from './test/invalid-timeout.enum.js';
import { LateRejectionFake } from './test/late-rejection.fake.js';
import { ProjectDefaults } from './test/project-defaults.util.js';
import { RunCount } from './test/run-count.enum.js';
import { Settle } from './test/settle.util.js';
import { Threshold } from './test/threshold.enum.js';
import { TimeoutBudget } from './test/timeout-budget.enum.js';

describe('GroupSettings — inheritance', () => {
  it('outside any group a test resolves its own options over the configured defaults', () => {
    const harness = new GroupSettingsHarness();
    expect(harness.resolve({ runs: RunCount.Smaller }, ProjectDefaults.strictGate)).toMatchObject({
      runs: RunCount.Smaller,
      threshold: Threshold.Strict,
    });
  });

  it('a test inside a group inherits the group settings over the configured defaults', () => {
    const harness = new GroupSettingsHarness();
    let resolved: ResolvedRunOptions | undefined;
    harness.within({ runs: RunCount.Smaller }, () => {
      resolved = harness.resolve({}, ProjectDefaults.strictGate);
    });
    expect(resolved).toMatchObject({ runs: RunCount.Smaller, threshold: Threshold.Strict });
  });

  it('an inner group overrides the outer group per field, keeping the rest', () => {
    const harness = new GroupSettingsHarness();
    let resolved: ResolvedRunOptions | undefined;
    harness.within({ runs: RunCount.Gated, threshold: Threshold.Half }, () => {
      harness.within({ threshold: Threshold.Lenient }, () => {
        resolved = harness.resolve();
      });
    });
    expect(resolved).toMatchObject({ runs: RunCount.Gated, threshold: Threshold.Lenient });
  });

  it("the test's own options win over every group, per field", () => {
    const harness = new GroupSettingsHarness();
    let resolved: ResolvedRunOptions | undefined;
    harness.within({ runs: RunCount.Gated, threshold: Threshold.Half }, () => {
      resolved = harness.resolve({ runs: RunCount.Single });
    });
    expect(resolved).toMatchObject({ runs: RunCount.Single, threshold: Threshold.Half });
  });

  it('an option left undefined at a level keeps the value from further up', () => {
    const harness = new GroupSettingsHarness();
    let resolved: ResolvedRunOptions | undefined;
    harness.within({ runs: RunCount.Gated }, () => {
      harness.within({ runs: undefined }, () => {
        resolved = harness.resolve({ runs: undefined });
      });
    });
    expect(resolved?.runs).toBe(RunCount.Gated);
  });

  it('a group with no options changes nothing', () => {
    const harness = new GroupSettingsHarness();
    let resolved: ResolvedRunOptions | undefined;
    harness.within({}, () => {
      resolved = harness.resolve();
    });
    expect(resolved).toEqual(harness.resolve());
  });

  it('settings end with the group: a sibling group does not see them', () => {
    const harness = new GroupSettingsHarness();
    let sibling: ResolvedRunOptions | undefined;
    harness.within({ runs: RunCount.Gated }, () => {});
    harness.within({}, () => {
      sibling = harness.resolve();
    });
    expect(sibling?.runs).toBe(RunCount.BuiltIn);
  });

  it('settings end with the group: tests declared after it do not see them', () => {
    const harness = new GroupSettingsHarness();
    harness.within({ runs: RunCount.Gated }, () => {});
    expect(harness.resolve().runs).toBe(RunCount.BuiltIn);
  });

  it('an error thrown while collecting a group propagates', () => {
    const harness = new GroupSettingsHarness();
    const error = GroupSettingsHarness.errorFrom(() =>
      harness.within({ runs: RunCount.Gated }, () => {
        harness.within(null, () => {});
      }),
    );
    expect(error.kind).toBe('usage');
  });

  it('settings end with the group even when its callback throws', () => {
    const harness = new GroupSettingsHarness();
    GroupSettingsHarness.errorFrom(() =>
      harness.within({ runs: RunCount.Gated }, () => {
        harness.within(null, () => {});
      }),
    );
    expect(harness.resolve().runs).toBe(RunCount.BuiltIn);
  });

  it('a group inferenceTimeout reaches the tests inside it', () => {
    const harness = new GroupSettingsHarness();
    let resolved: ResolvedRunOptions | undefined;
    harness.within({ inferenceTimeout: InferenceTimeout.BuiltInMs * 2 }, () => {
      resolved = harness.resolve();
    });
    expect(resolved?.inferenceTimeout).toBe(InferenceTimeout.BuiltInMs * 2);
  });

  it('a group strict reaches the tests inside it over a lenient configured default', () => {
    const harness = new GroupSettingsHarness();
    let resolved: ResolvedRunOptions | undefined;
    harness.within({ strict: true }, () => {
      resolved = harness.resolve({}, { strict: false });
    });
    expect(resolved?.strict).toBe(true);
  });

  it('an inner group can relax strict again for its own tests', () => {
    const harness = new GroupSettingsHarness();
    let resolved: ResolvedRunOptions | undefined;
    harness.within({ strict: true }, () => {
      harness.within({ strict: false }, () => {
        resolved = harness.resolve();
      });
    });
    expect(resolved?.strict).toBe(false);
  });

  it("the test's own strict wins over the group's", () => {
    const harness = new GroupSettingsHarness();
    let resolved: ResolvedRunOptions | undefined;
    harness.within({ strict: false }, () => {
      resolved = harness.resolve({ strict: true });
    });
    expect(resolved?.strict).toBe(true);
  });

  it('options changed after the group is declared do not reach its tests', () => {
    const harness = new GroupSettingsHarness();
    const options = { runs: RunCount.Smaller };
    let resolved: ResolvedRunOptions | undefined;
    const collect = harness.groups.declare(options, () => {
      resolved = harness.resolve();
    });
    options.runs = RunCount.Hundred;
    collect();
    expect(resolved?.runs).toBe(RunCount.Smaller);
  });
});

describe('GroupSettings — test timeout', () => {
  it('with no timeout declared anywhere, the formula uses the runs a group resolves', () => {
    const harness = new GroupSettingsHarness();
    let resolved: ResolvedRunOptions | undefined;
    harness.within({ runs: RunCount.Gated }, () => {
      resolved = harness.resolve();
    });
    expect(resolved?.testTimeout).toBe(
      TimeoutBudget.SmokeMs + (RunCount.Gated - 1) * TimeoutBudget.PerExtraRunMs,
    );
  });

  it('a group testTimeout beats the formula, even when an inner group changes runs', () => {
    const harness = new GroupSettingsHarness();
    let resolved: ResolvedRunOptions | undefined;
    harness.within({ testTimeout: CustomTimeout.Long }, () => {
      harness.within({ runs: RunCount.Hundred }, () => {
        resolved = harness.resolve();
      });
    });
    expect(resolved?.testTimeout).toBe(CustomTimeout.Long);
  });

  it('a configured testTimeout beats the formula when a group changes runs', () => {
    const harness = new GroupSettingsHarness();
    let resolved: ResolvedRunOptions | undefined;
    harness.within({ runs: RunCount.Hundred }, () => {
      resolved = harness.resolve({}, { testTimeout: CustomTimeout.Longer });
    });
    expect(resolved?.testTimeout).toBe(CustomTimeout.Longer);
  });

  it('the nearest declared testTimeout wins: inner group over outer group and configuration', () => {
    const harness = new GroupSettingsHarness();
    let resolved: ResolvedRunOptions | undefined;
    harness.within({ testTimeout: CustomTimeout.Longer }, () => {
      harness.within({ testTimeout: CustomTimeout.Long }, () => {
        resolved = harness.resolve({}, { testTimeout: CustomTimeout.SlowReply });
      });
    });
    expect(resolved?.testTimeout).toBe(CustomTimeout.Long);
  });

  it("the test's own testTimeout wins over a group testTimeout", () => {
    const harness = new GroupSettingsHarness();
    let resolved: ResolvedRunOptions | undefined;
    harness.within({ testTimeout: CustomTimeout.Long }, () => {
      resolved = harness.resolve({ testTimeout: CustomTimeout.Short });
    });
    expect(resolved?.testTimeout).toBe(CustomTimeout.Short);
  });
});

describe('GroupSettings — validation', () => {
  it.each<[unknown]>([
    [{ runs: InvalidTestDefault.Zero }],
    [{ runs: InvalidTestDefault.Fractional }],
    [{ threshold: InvalidTestDefault.Zero }],
    [{ threshold: InvalidTestDefault.AboveOne }],
    [{ testTimeout: InvalidTimeout.Zero }],
    [{ inferenceTimeout: InvalidTimeout.AboveTimerMax }],
    [{ strict: String(true) }],
    [{ run: RunCount.Smaller }],
    [null],
    [undefined],
    [[]],
  ])('rejects group options %j as usage without running the callback', (options) => {
    const harness = new GroupSettingsHarness();
    let ran = false;
    const error = GroupSettingsHarness.errorFrom(() =>
      harness.groups.declare(options, () => {
        ran = true;
      }),
    );
    expect(error.kind).toBe('usage');
    expect(ran).toBe(false);
  });

  it.each<[string, unknown]>([
    ['a missing callback', undefined],
    ['a string', GroupBodyResult.Value],
    ['an object', {}],
  ])('rejects %s in place of the callback as usage', (_label, body) => {
    const error = GroupSettingsHarness.errorFrom(() =>
      new GroupSettingsHarness().groups.declare({}, body),
    );
    expect(error.kind).toBe('usage');
  });

  it('rejects an async callback as usage and leaves no settings behind', () => {
    const harness = new GroupSettingsHarness();
    const error = GroupSettingsHarness.errorFrom(() =>
      harness.within({ runs: RunCount.Gated }, async () => {}),
    );
    expect(error.kind).toBe('usage');
    expect(harness.resolve().runs).toBe(RunCount.BuiltIn);
  });

  it('rejects a callback returning a thenable as usage', () => {
    const error = GroupSettingsHarness.errorFrom(() =>
      new GroupSettingsHarness().within({}, () => new LateRejectionFake()),
    );
    expect(error.kind).toBe('usage');
  });

  it('absorbs a later rejection from an async callback so it never goes unhandled', async () => {
    const late = new LateRejectionFake();
    GroupSettingsHarness.errorFrom(() => new GroupSettingsHarness().within({}, () => late));
    await Settle.pending();
    expect(late.absorbed).toBe(true);
  });

  it('rejects a callback returning a value as usage', () => {
    const error = GroupSettingsHarness.errorFrom(() =>
      new GroupSettingsHarness().within({}, () => GroupBodyResult.Value),
    );
    expect(error.kind).toBe('usage');
  });
});
