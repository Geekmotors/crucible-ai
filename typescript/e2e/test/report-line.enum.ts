enum ReportLine {
  DefaultsGatedFailure = 'FAILED: 0/2 runs passed (pass rate 0) against threshold 1 (need 2).',
  ExcerptBound = 'Response excerpt (first 40 of',
  FirstStrictExtraction = 'Extraction 1 of 1 (strict):',
  JudgeReasoning = 'Judge reasoning:',
  Facts = 'Facts:',
  JudgeStamp = 'Judge: openai-compatible "stub-judge"; served as "stub-judge-2026-11-19", ',
  CrucibleStamp = 'Crucible: crucible-ai ',
}

export { ReportLine };
