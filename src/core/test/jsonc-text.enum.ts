enum JsoncText {
  UnterminatedBlockComment = '{\n  "name": "crucible"\n  /* never closed\n}',
  UnterminatedString = '{\n  "name": "crucible\n}',
  MissingCommaOnLineThree = '{\n  "name": "crucible"\n  "runs": 10\n}',
  MissingCommaOnLineThreeCarriageReturn = '{\r  "name": "crucible"\r  "runs": 10\r}',
}

export { JsoncText };
