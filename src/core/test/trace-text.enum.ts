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
}

export { TraceText };
