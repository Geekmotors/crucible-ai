import { describe, expect, it } from '@jest/globals';
import { CrucibleError } from './errors.js';
import { RunOptionsResolver } from './run-options-resolver.util.js';
import { Capture } from './test/capture.util.js';
import { CustomTimeout } from './test/custom-timeout.enum.js';
import { InvalidTimeout } from './test/invalid-timeout.enum.js';
import { RunCount } from './test/run-count.enum.js';
import { ProjectDefaults } from './test/project-defaults.util.js';
import { Threshold } from './test/threshold.enum.js';
import { TimeoutBudget } from './test/timeout-budget.enum.js';

describe('RunOptionsResolver', () => {
  it.each([
    [{}],
    [{ runs: RunCount.Gated }],
    [{ threshold: Threshold.Lenient }],
    [{ runs: RunCount.Gated, threshold: Threshold.Strict }],
    [{ runs: RunCount.Single, threshold: Threshold.Certain }],
    [{ inferenceTimeout: CustomTimeout.Long }],
    [{ testTimeout: CustomTimeout.Short }],
    [{ inferenceTimeout: TimeoutBudget.TimerMaxMs, testTimeout: TimeoutBudget.TimerMaxMs }],
  ])('accepts valid options %j', (opts) => {
    expect(() => new RunOptionsResolver().validate(opts)).not.toThrow();
  });

  it.each([
    [{ threshold: 0 }],
    [{ threshold: 1.5 }],
    [{ threshold: -0.5 }],
    [{ threshold: Number.NaN }],
    [{ threshold: '0.9' }],
    [{ runs: 0 }],
    [{ runs: -1 }],
    [{ runs: 2.5 }],
    [{ runs: Number.NaN }],
    [{ runs: '5' }],
    [{ runs: Number.POSITIVE_INFINITY }],
    [{ threshold: Number.POSITIVE_INFINITY }],
    [{ run: 5 }],
    [null],
    [{ inferenceTimeout: InvalidTimeout.Zero }],
    [{ inferenceTimeout: InvalidTimeout.Negative }],
    [{ inferenceTimeout: InvalidTimeout.Fractional }],
    [{ inferenceTimeout: InvalidTimeout.AboveTimerMax }],
    [{ testTimeout: InvalidTimeout.Zero }],
    [{ testTimeout: InvalidTimeout.Negative }],
    [{ testTimeout: InvalidTimeout.Fractional }],
    [{ testTimeout: InvalidTimeout.AboveTimerMax }],
    [{ inferenceTimeout: String(CustomTimeout.Long) }],
    [{ testTimeout: Number.POSITIVE_INFINITY }],
  ])('rejects %j as a usage error', (opts) => {
    const error = Capture.thrown(() => new RunOptionsResolver().validate(opts));
    expect(error).toBeInstanceOf(CrucibleError);
    expect((error as CrucibleError).kind).toBe('usage');
  });

  it('defaults to a single run at threshold 1.0 when no options are given', () => {
    expect(new RunOptionsResolver().resolve({})).toMatchObject({
      runs: RunCount.Single,
      threshold: Threshold.Certain,
    });
  });

  it('defaults the threshold to 1.0 when only runs is given', () => {
    expect(new RunOptionsResolver().resolve({ runs: RunCount.Gated })).toMatchObject({
      runs: RunCount.Gated,
      threshold: Threshold.Certain,
    });
  });

  it('defaults runs to 1 when only the threshold is given', () => {
    expect(new RunOptionsResolver().resolve({ threshold: Threshold.Strict })).toMatchObject({
      runs: RunCount.Single,
      threshold: Threshold.Strict,
    });
  });

  it('refuses to resolve invalid options', () => {
    const error = Capture.thrown(() => new RunOptionsResolver().resolve({ runs: 0 }));
    expect((error as CrucibleError).kind).toBe('usage');
  });

  it('takes every omitted field from the configured defaults', () => {
    expect(new RunOptionsResolver().resolve({}, ProjectDefaults.strictGate)).toMatchObject(
      ProjectDefaults.strictGate,
    );
  });

  it('overrides per field — a declared runs keeps the configured threshold', () => {
    expect(
      new RunOptionsResolver().resolve({ runs: RunCount.Smaller }, ProjectDefaults.strictGate),
    ).toMatchObject({ runs: RunCount.Smaller, threshold: Threshold.Strict });
  });

  it('uses the declared values entirely when both are declared', () => {
    expect(
      new RunOptionsResolver().resolve(
        { runs: RunCount.Smaller, threshold: Threshold.Half },
        ProjectDefaults.strictGate,
      ),
    ).toMatchObject({ runs: RunCount.Smaller, threshold: Threshold.Half });
  });

  it('falls back to built-ins for a field the configured defaults leave unset', () => {
    expect(new RunOptionsResolver().resolve({}, { threshold: Threshold.Strict })).toMatchObject({
      runs: RunCount.Single,
      threshold: Threshold.Strict,
    });
  });

  it('uses the built-in 30 s inference timeout when nothing declares one', () => {
    expect(new RunOptionsResolver().resolve({}).inferenceTimeout).toBe(TimeoutBudget.SmokeMs);
  });

  it('sizes the built-in test timeout from the resolved run count', () => {
    expect(new RunOptionsResolver().resolve({}, ProjectDefaults.strictGate).testTimeout).toBe(
      TimeoutBudget.SmokeMs + (RunCount.Gated - 1) * TimeoutBudget.PerExtraRunMs,
    );
  });

  it('takes omitted timeouts from the configured defaults', () => {
    expect(
      new RunOptionsResolver().resolve(
        {},
        { inferenceTimeout: CustomTimeout.Long, testTimeout: CustomTimeout.Longer },
      ),
    ).toMatchObject({ inferenceTimeout: CustomTimeout.Long, testTimeout: CustomTimeout.Longer });
  });

  it('prefers declared timeouts over the configured defaults, per field', () => {
    expect(
      new RunOptionsResolver().resolve(
        { testTimeout: CustomTimeout.Short },
        { inferenceTimeout: CustomTimeout.Long, testTimeout: CustomTimeout.Longer },
      ),
    ).toMatchObject({ inferenceTimeout: CustomTimeout.Long, testTimeout: CustomTimeout.Short });
  });
});
