enum InvalidKeyEnv {
  Empty = '',
  LeadingDigit = '1_API_KEY',
  Dashed = 'GATEWAY-API-KEY',
  Spaced = 'GATEWAY API KEY',
  KeyValue = 'sk-proj-abc123',
}

export { InvalidKeyEnv };
