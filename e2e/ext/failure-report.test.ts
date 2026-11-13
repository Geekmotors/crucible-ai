import { beforeAll, describe, expect, it } from '@jest/globals';
import scenario from './fixtures/projects/failure-report/scenario.json' with { type: 'json' };
import extraction from './fixtures/projects/failure-report/extraction.json' with { type: 'json' };
import { ChildProject } from '../test/child-project.enum.js';
import type { JestOutcome } from '../test/jest-outcome.js';
import { JestProcess } from '../test/jest-process.util.js';
import { ReportLine } from '../test/report-line.enum.js';
import { ReportPattern } from '../test/report-pattern.util.js';

describe('a deliberately failing inference test', () => {
  let outcome: JestOutcome;

  beforeAll(async () => {
    outcome = await JestProcess.run(ChildProject.FailureReport);
  });

  it('fails the Jest run', () => {
    expect(outcome.exitCode).not.toBe(0);
  });

  it('reports a semantic failure of every run the project testDefaults declare', () => {
    expect(outcome.output).toContain(ReportLine.DefaultsGatedFailure);
  });

  it('names the failed claim', () => {
    expect(outcome.output).toContain(scenario.claim);
  });

  it('shows what the judge extracted, and why, under the failed run', () => {
    expect(outcome.output).toMatch(
      ReportPattern.extractionWithReasoning(`"${extraction.target}" as number → null`),
    );
  });

  it('cuts the response excerpt at the project excerptChars', () => {
    expect(outcome.output).toContain(
      `${ReportLine.ExcerptBound} ${scenario.response.length} chars)`,
    );
  });
});
