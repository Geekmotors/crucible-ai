enum ConfigText {
  CommentedJsonc = '{\n  // the judge\n  "provider": "fake", /* inline */\n  "model": "test-model",\n}\n',
  WithSchemaReference = '{ "$schema": "./node_modules/crucible/schemas/crucible.config.schema.json", "provider": "fake", "model": "test-model" }',
  UnterminatedComment = '{ "provider": "fake", "model": "test-model" /* never closed }',
  MalformedWithKey = '{ "provider": "fake", "model": "test-model", sk-or-v1-leaked-secret-value }',
}

export { ConfigText };
