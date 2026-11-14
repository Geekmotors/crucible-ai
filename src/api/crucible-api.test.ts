import { describe, expect, it } from '@jest/globals';
import { VitestBinding } from '../bindings/vitest.js';
import { TestName } from '../bindings/test/test-name.enum.js';
import { VitestProperty } from '../bindings/test/vitest-property.enum.js';
import { VitestRunnerFake } from '../bindings/test/vitest-runner.fake.js';
import { CrucibleError } from '../core/errors.js';
import { Capture } from '../core/test/capture.util.js';
import { CrucibleApi } from './crucible-api.js';
import type { CrucibleDescribe } from './crucible-describe.js';
import type { CrucibleIt } from './crucible-it.js';

describe('CrucibleApi', () => {
  it('registers crucible.it and crucible.describe tests with the runner of its spec', () => {
    const runner = new VitestRunnerFake();
    const crucible = CrucibleApi.build<CrucibleIt, CrucibleDescribe>(
      new VitestBinding(runner.source).spec(),
    );
    crucible.describe(TestName.Group, () => {
      crucible.it(TestName.Inside, async () => {});
    });
    crucible.it.todo(TestName.Planned);
    expect(runner.names()).toEqual([`${TestName.Group} > ${TestName.Inside}`, TestName.Planned]);
  });

  it("applies the spec's blocked variants", () => {
    const runner = new VitestRunnerFake();
    const crucible = CrucibleApi.build<Record<string, unknown>, CrucibleDescribe>(
      new VitestBinding(runner.source).spec(),
    );
    const error = Capture.thrown(() => crucible.it[VitestProperty.Fails]);
    expect(error).toBeInstanceOf(CrucibleError);
    expect((error as CrucibleError).kind).toBe('usage');
  });
});
