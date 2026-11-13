enum TimeoutBudget {
  SmokeMs = 30000,
  BuiltInTestMs = 39000,
  PerExtraRunMs = 1000,
  CeilingMarginMs = 5000,
  TimerMaxMs = 2147483647,
}

export { TimeoutBudget };
