enum TraceText {
  Prefix = '[crucible:debug]',
  TestStarted = 'test started',
  EngineInit = 'engine init',
  ConfigResolved = 'config resolved',
  MetaKey = 'temperature',
  MetaSecret = 'sk-meta-secret',
  ReportBody = 'the rendered report',
  Prompt = 'the judge prompt',
  Reply = '{"verdict":true,"reasoning":"fine"}',
  Provider = 'fake',
  SystemPrompt = 'the judge instructions',
  ExpiredFragment = 'deadline of',
  VerdictPass = 'verdict pass',
  VerdictFalse = 'judge verdict false',
  OneDiscarded = '1 in-flight run(s) discarded',
  UnparseableReply = 'not json at all',
  Flake = 'flake',
}

export { TraceText };
