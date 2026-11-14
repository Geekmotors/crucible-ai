import { describe, expect, it } from '@jest/globals';
import type { CrucibleError } from './errors.js';
import { RunOptionsResolver } from './run-options-resolver.util.js';
import { Capture } from './test/capture.util.js';
import { InvalidTestDefault } from './test/invalid-test-default.enum.js';

describe('RunOptionsResolver', () => {
  it('refuses to resolve invalid options as a usage error', () => {
    const error = Capture.thrown(() =>
      new RunOptionsResolver().resolve({ runs: InvalidTestDefault.Zero }),
    );
    expect((error as CrucibleError).kind).toBe('usage');
  });
});
