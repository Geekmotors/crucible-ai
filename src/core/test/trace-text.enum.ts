enum TraceText {
  TestStarted = 'test started',
  MetaKey = 'temperature',
  MetaSecret = 'sk-meta-secret',
  ReportBody = 'the rendered report',
  Prompt = 'the judge prompt',
  Reply = '{"verdict":true,"reasoning":"fine"}',
  Provider = 'fake',
  ExpiredFragment = 'deadline of',
  VerdictPass = 'verdict pass',
  OneDiscarded = '1 in-flight run(s) discarded',
  UnparseableReply = 'not json at all',
  Flake = 'flake',
}

export { TraceText };
