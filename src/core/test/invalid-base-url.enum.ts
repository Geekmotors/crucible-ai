enum InvalidBaseUrl {
  Empty = '',
  NotAUrl = 'not a url',
  MissingScheme = 'localhost:11434/v1',
  Ftp = 'ftp://models.example.com/v1',
  WithCredentials = 'https://user:secret@gateway.example.com/v1',
  WithQuery = 'https://gateway.example.com/v1?api-version=preview',
  WithFragment = 'https://gateway.example.com/v1#chat',
  WithEmptyQuery = 'https://gateway.example.com/v1?',
}

export { InvalidBaseUrl };
