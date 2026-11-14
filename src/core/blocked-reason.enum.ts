enum BlockedReason {
  InvertedOutcome = 'a pass-rate gate passes when enough runs pass, so an inverted outcome is ambiguous; assert the expected failure inside the body instead.',
  ConcurrentTests = 'the runs of a Crucible test already execute concurrently under one test deadline; running tests concurrently as well would share that budget unpredictably.',
  GroupScheduling = 'Crucible groups assume their tests are collected and run in declaration order, one test at a time, each test running its own runs concurrently; changing the order or running the tests of a group concurrently would share test deadlines unpredictably.',
}

export { BlockedReason };
