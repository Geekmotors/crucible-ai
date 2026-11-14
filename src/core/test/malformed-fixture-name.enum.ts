enum MalformedFixtureName {
  TwoOutcomes = 'two expected outcomes',
  NoOutcome = 'no expected outcome',
  MessageText = 'error message text',
  UnknownKind = 'an unknown error kind',
  TextRetryable = 'a non-boolean retryable',
  NonKebabId = 'an id that is not kebab-case',
  NoDescription = 'a case without a description',
  NoCases = 'no cases',
  ExtraField = 'an unknown top-level field',
  RetryableOnUsage = 'retryable on a usage error',
  InfraWithoutRetryable = 'an infra error without retryable',
  EmptyDescription = 'an empty description',
  NumericText = 'a text outcome that is not a string',
  NoInput = 'a case without an input',
  NonKebabArea = 'an area that is not kebab-case',
  CasesNotList = 'cases that are not a list',
  NotObject = 'a file that is not an object',
}

export { MalformedFixtureName };
