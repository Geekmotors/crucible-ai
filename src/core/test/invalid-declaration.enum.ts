enum InvalidDeclaration {
  NoArguments = 'no arguments',
  OptionsWithoutBody = 'options without a body',
  TwoBodies = 'two bodies',
  TimeoutInPlaceOfBody = 'a timeout in place of the body',
  InvalidOptions = 'invalid options',
  InvalidTimeout = 'an invalid trailing timeout',
  TimeoutAndTestTimeout = 'a trailing timeout and a testTimeout option',
  ArgumentAfterTimeout = 'an argument after the timeout',
  TimeoutAfterEmptySlot = 'a timeout after an empty body slot',
  ArgumentAfterBody = 'an argument after the body',
  ArgumentAfterCallback = 'an argument after the callback',
  ArgumentAfterOptionsAndCallback = 'an argument after options and callback',
  OptionsWithoutCallback = 'options without a callback',
  TextInPlaceOfCallback = 'text in place of the callback',
  ObjectInPlaceOfCallback = 'an object in place of the callback',
}

export { InvalidDeclaration };
