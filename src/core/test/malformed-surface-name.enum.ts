enum MalformedSurfaceName {
  Uncited = 'an item without fixtures',
  UnknownCase = 'a fixture id no case has',
  OptionNotExercised = 'an option cited by a case that never sets it',
  CallOptionOfOtherAssertion = 'a call option cited by a case of the other assertion',
  CallOptionOnlyRunFacts = 'a call option cited by a case setting only run facts',
  WrongErrorKind = 'an error kind cited by a case failing with another kind',
  WrongRetryable = 'an infra error cited by a case with the other retryable',
  TextNotRendered = 'report text cited by a case whose text lacks it',
  OptionMissing = 'a run option TypeScript has but the manifest lacks',
  OptionUnknown = 'a run option TypeScript does not have',
  OptionTwice = 'a run option listed twice',
  DefaultDiffers = 'a default the config schema disagrees with',
  ValuesDiffer = 'config field values the config schema disagrees with',
  OperationMissing = 'an operation the spec has but the manifest lacks',
  CallOptionMissing = 'a call option TypeScript has but the manifest lacks',
  FunctionMissing = 'a function TypeScript has but the manifest lacks',
  ConfigFieldMissing = 'a config field the config schema has but the manifest lacks',
  ProviderMissing = 'a provider the config schema has but the manifest lacks',
  RetryableMissing = 'an infra error without its non-retryable entry',
}

export { MalformedSurfaceName };
