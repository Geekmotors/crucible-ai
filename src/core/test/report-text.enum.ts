enum ReportText {
  Failed = 'FAILED:',
  Errored = 'ERRORED, not failed:',
  Passed = 'PASSED:',
  PassedRun = '[PASSED]',
  NoJudgeCalls = 'Judge calls: none recorded',
  NotShownInFull = 'not shown in full',
  FailedRun = '[FAILED]',
  ErroredRun = '[ERRORED]',
  DiscardedRun = '[DISCARDED]',
  Smoke = 'the smoke run',
  Counts = 'Runs:',
  TallyHeader = 'Failing claims (first failure of each of the',
  JudgeErroredLabel = 'a judge call errored',
  ThrownOnlyLabel = 'thrown without a false verdict',
  NearMissRate = 'pass rate 0.949',
}

export { ReportText };
