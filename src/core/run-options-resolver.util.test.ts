import { describe, expect, it } from '@jest/globals';
import { CrucibleError } from './errors.js';
import { RunOptionsResolver } from './run-options-resolver.util.js';
import { Capture } from './test/capture.util.js';
import { RunCount } from './test/run-count.enum.js';
import { ProjectDefaults } from './test/project-defaults.util.js';
import { Threshold } from './test/threshold.enum.js';

describe('RunOptionsResolver', () => {
  it.each([
    [{}],
    [{ runs: RunCount.Gated }],
    [{ threshold: Threshold.Lenient }],
    [{ runs: RunCount.Gated, threshold: Threshold.Strict }],
    [{ runs: RunCount.Single, threshold: Threshold.Certain }],
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
  ])('rejects %j as a usage error', (opts) => {
    const error = Capture.thrown(() => new RunOptionsResolver().validate(opts));
    expect(error).toBeInstanceOf(CrucibleError);
    expect((error as CrucibleError).kind).toBe('usage');
  });

  it('defaults to a single run at threshold 1.0 when no options are given', () => {
    expect(new RunOptionsResolver().resolve({})).toEqual({
      runs: RunCount.Single,
      threshold: Threshold.Certain,
    });
  });

  it('defaults the threshold to 1.0 when only runs is given', () => {
    expect(new RunOptionsResolver().resolve({ runs: RunCount.Gated })).toEqual({
      runs: RunCount.Gated,
      threshold: Threshold.Certain,
    });
  });

  it('defaults runs to 1 when only the threshold is given', () => {
    expect(new RunOptionsResolver().resolve({ threshold: Threshold.Strict })).toEqual({
      runs: RunCount.Single,
      threshold: Threshold.Strict,
    });
  });

  it('refuses to resolve invalid options', () => {
    const error = Capture.thrown(() => new RunOptionsResolver().resolve({ runs: 0 }));
    expect((error as CrucibleError).kind).toBe('usage');
  });

  it('takes every omitted field from the configured defaults', () => {
    expect(new RunOptionsResolver().resolve({}, ProjectDefaults.strictGate)).toEqual(
      ProjectDefaults.strictGate,
    );
  });

  it('overrides per field — a declared runs keeps the configured threshold', () => {
    expect(
      new RunOptionsResolver().resolve({ runs: RunCount.Smaller }, ProjectDefaults.strictGate),
    ).toEqual({ runs: RunCount.Smaller, threshold: Threshold.Strict });
  });

  it('uses the declared values entirely when both are declared', () => {
    expect(
      new RunOptionsResolver().resolve(
        { runs: RunCount.Smaller, threshold: Threshold.Half },
        ProjectDefaults.strictGate,
      ),
    ).toEqual({ runs: RunCount.Smaller, threshold: Threshold.Half });
  });

  it('falls back to built-ins for a field the configured defaults leave unset', () => {
    expect(new RunOptionsResolver().resolve({}, { threshold: Threshold.Strict })).toEqual({
      runs: RunCount.Single,
      threshold: Threshold.Strict,
    });
  });
});
