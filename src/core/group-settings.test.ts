import { describe, expect, it } from '@jest/globals';
import type { ResolvedRunOptions } from './run-options.js';
import { DeferredGroupsFake } from './test/deferred-groups.fake.js';
import { GroupSettingsHarness } from './test/group-settings-harness.util.js';
import { GroupBodyResult } from './test/group-body-result.enum.js';
import { LateRejectionFake } from './test/late-rejection.fake.js';
import { RowValue } from './test/row-value.enum.js';
import { RunCount } from './test/run-count.enum.js';
import { Settle } from './test/settle.util.js';
import { Threshold } from './test/threshold.enum.js';

describe('GroupSettings — scope', () => {
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
        harness.within({}, async () => {});
      }),
    );
    expect(error.kind).toBe('usage');
  });

  it('settings end with the group even when its callback throws', () => {
    const harness = new GroupSettingsHarness();
    GroupSettingsHarness.errorFrom(() =>
      harness.within({ runs: RunCount.Gated }, () => {
        harness.within({}, async () => {});
      }),
    );
    expect(harness.resolve().runs).toBe(RunCount.BuiltIn);
  });

  it('options changed after the group is declared do not reach its tests', () => {
    const harness = new GroupSettingsHarness();
    const options = { runs: RunCount.Smaller };
    let resolved: ResolvedRunOptions | undefined;
    const collect = harness.declare(options, () => {
      resolved = harness.resolve();
    });
    options.runs = RunCount.Hundred;
    collect();
    expect(resolved?.runs).toBe(RunCount.Smaller);
  });

  it('passes the runner arguments, such as describe.each row values, to the callback', () => {
    const harness = new GroupSettingsHarness();
    let received: unknown[] = [];
    harness.declare({}, (...row: unknown[]) => {
      received = row;
    })(RowValue.Apples, RowValue.Pears);
    expect(received).toEqual([RowValue.Apples, RowValue.Pears]);
  });
});

describe('GroupSettings — validation', () => {
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

describe('GroupSettings — runners that collect groups later', () => {
  it('a nested group collected after its parent returns inherits the parent settings', () => {
    const runner = new DeferredGroupsFake();
    const harness = new GroupSettingsHarness(runner.path);
    let resolved: ResolvedRunOptions | undefined;
    runner.register(
      harness.declare({ runs: RunCount.Gated, threshold: Threshold.Half }, () => {
        runner.register(
          harness.declare({ threshold: Threshold.Lenient }, () => {
            resolved = harness.resolve();
          }),
        );
      }),
    );
    runner.collect();
    expect(resolved).toMatchObject({ runs: RunCount.Gated, threshold: Threshold.Lenient });
  });

  it('a plain runner group between keeps the inheritance', () => {
    const runner = new DeferredGroupsFake();
    const harness = new GroupSettingsHarness(runner.path);
    let resolved: ResolvedRunOptions | undefined;
    runner.register(
      harness.declare({ runs: RunCount.Smaller }, () => {
        runner.register(() => {
          resolved = harness.resolve();
        });
      }),
    );
    runner.collect();
    expect(resolved).toMatchObject({ runs: RunCount.Smaller });
  });

  it('settings do not reach a sibling group collected later', () => {
    const runner = new DeferredGroupsFake();
    const harness = new GroupSettingsHarness(runner.path);
    let resolved: ResolvedRunOptions | undefined;
    runner.register(harness.declare({ runs: RunCount.Smaller }, () => {}));
    runner.register(() => {
      resolved = harness.resolve();
    });
    runner.collect();
    expect(resolved).toMatchObject({ runs: RunCount.BuiltIn });
  });

  it('a test outside every group keeps only its own options', () => {
    const runner = new DeferredGroupsFake();
    const harness = new GroupSettingsHarness(runner.path);
    runner.register(harness.declare({ runs: RunCount.Smaller }, () => {}));
    runner.collect();
    expect(harness.resolve({ threshold: Threshold.Half })).toMatchObject({
      runs: RunCount.BuiltIn,
      threshold: Threshold.Half,
    });
  });
});

describe('GroupSettings — runners whose group path loses the group', () => {
  it('a group callback the runner places in no group is a usage error', () => {
    const harness = new GroupSettingsHarness(new DeferredGroupsFake().path);
    const error = GroupSettingsHarness.errorFrom(() =>
      harness.within({ runs: RunCount.Smaller }, () => {}),
    );
    expect(error.kind).toBe('usage');
  });
});
