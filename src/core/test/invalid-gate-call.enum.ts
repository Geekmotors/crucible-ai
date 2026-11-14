enum InvalidGateCall {
  NoArguments = 'no arguments',
  OptionsWithoutBody = 'options without a body',
  TwoBodies = 'two bodies',
  ArgumentAfterBody = 'an argument after the body',
  ArgumentAfterAnEmptySlot = 'an argument after the body and an empty slot',
  ArgumentAfterOptionsAndBody = 'an argument after options and body',
  ArgumentAfterOptionsBodyAndAnEmptySlot = 'an argument after options, body and an empty slot',
  InvalidOptions = 'invalid options',
  NonObjectOptions = 'options that are not an object',
}

export { InvalidGateCall };
