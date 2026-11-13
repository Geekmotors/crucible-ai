import { beforeAll, describe, expect, it } from '@jest/globals';
import scenario from './fixtures/projects/debug-trace/scenario.json' with { type: 'json' };
import { ChildProject } from '../test/child-project.enum.js';
import type { JestOutcome } from '../test/jest-outcome.js';
import { JestProcess } from '../test/jest-process.util.js';
import { TraceLine } from '../test/trace-line.enum.js';
import { TracePattern } from '../test/trace-pattern.util.js';
import { VerbosityOverride } from '../test/verbosity-override.enum.js';

describe('CRUCIBLE_VERBOSE=debug against the real provider', () => {
  let outcome: JestOutcome;

  beforeAll(async () => {
    outcome = await JestProcess.run(ChildProject.DebugTrace, {
      CRUCIBLE_VERBOSE: VerbosityOverride.Debug,
    });
  });

  it('passes the traced test', () => {
    expect(outcome.exitCode).toBe(0);
  });

  it('overrides the configured default and traces the resolved config', () => {
    expect(outcome.output).toContain(TraceLine.ConfigResolved);
  });

  it('traces the provider request', () => {
    expect(outcome.output).toContain(TraceLine.ProviderRequest);
  });

  it('sends the loaded run state to the judge', () => {
    expect(outcome.output).toMatch(TracePattern.promptCarryingState(scenario.state[0]));
  });

  it('traces the recorded verdict', () => {
    expect(outcome.output).toContain(TraceLine.VerdictTrue);
  });

  it('traces the recorded extraction', () => {
    expect(outcome.output).toContain(
      `${TraceLine.ExtractionFor} "${scenario.extract.target}" as string`,
    );
  });

  it('never reveals the API key', () => {
    expect(JestProcess.revealsApiKey(outcome.output)).toBe(false);
  });
});
