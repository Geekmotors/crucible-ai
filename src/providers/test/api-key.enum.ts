enum ApiKey {
  Valid = 'sk-test',
  Other = 'sk-other',
  Blank = '   ',
  Empty = '',
  WithLineBreak = 'sk-test\nsk-next',
  WithControlCharacter = 'sk-te\u0007st',
  NonAscii = 'sk-t\u00e9st',
}

export { ApiKey };
