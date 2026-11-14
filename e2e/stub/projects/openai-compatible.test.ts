import { beforeAll, describe, expect, it } from '@jest/globals';
import scenario from './fixtures/openai-compatible/scenario.json' with { type: 'json' };
import { ChildProject } from '../../test/child-project.enum.js';
import type { JestOutcome } from '../../test/jest-outcome.js';
import { JestProcess } from '../../test/jest-process.util.js';
import { JudgeKey } from '../../test/judge-key.enum.js';
import { TraceLine } from '../../test/trace-line.enum.js';
import { VerbosityOverride } from '../../test/verbosity-override.enum.js';

describe('the openai-compatible provider against a keyless loopback endpoint', () => {
  let outcome: JestOutcome;

  beforeAll(async () => {
    outcome = await JestProcess.run(ChildProject.OpenAiCompatible, {
      CRUCIBLE_VERBOSE: VerbosityOverride.Debug,
      [JudgeKey.Variable]: undefined,
    });
  });

  it('passes the judged test with no judge key set', () => {
    expect(outcome.exitCode).toBe(0);
  });

  it('resolves the openai-compatible provider from the project config', () => {
    expect(outcome.output).toContain(TraceLine.CompatibleConfigResolved);
  });

  it('sends the judge calls through the openai-compatible provider', () => {
    expect(outcome.output).toContain(TraceLine.CompatibleProviderRequest);
  });

  it('records the verdict and the extraction', () => {
    expect(outcome.output).toContain(TraceLine.VerdictTrue);
    expect(outcome.output).toContain(
      `${TraceLine.ExtractionFor} "${scenario.extract.target}" as string`,
    );
  });
});
