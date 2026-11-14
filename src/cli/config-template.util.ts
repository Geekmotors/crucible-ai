import { CONFIG_FILE_NAMES } from '../core/config-boundary.js';

class ConfigTemplate {
  static readonly FILE_NAME = CONFIG_FILE_NAMES[1];

  private static readonly LINES = [
    '{',
    '  "$schema": "./node_modules/crucible-ai/schemas/crucible.config.schema.json",',
    '',
    '  // Judge provider: "openrouter", "openai" or "openai-compatible" (the last also needs',
    '  // a "baseUrl", e.g. "http://localhost:11434/v1"). The API key comes from the environment.',
    '  "provider": "openrouter",',
    '  "model": "deepseek/deepseek-v4-flash-0731",',
    '  // OpenRouter reasoning setting that speeds up the model above; extra request fields',
    '  // go to the provider as-is, so remove or change this when you switch provider.',
    '  "meta": { "reasoning": { "effort": "low" } },',
    '',
    '  // Every line below shows a default. Uncomment a line to change it.',
    '  // "apiKeyEnv": "CRUCIBLE_JUDGE_KEY", // the variable holding the key, never the key',
    '  // "verbosity": "default", // "default", "full" or "debug"',
    '  // "excerptChars": 500, // length of the response excerpt and Facts in failure reports',
    '  // "testDefaults": {',
    '  //   "runs": 10,',
    '  //   "threshold": 0.9, // at least 9 of 10 runs must pass',
    '  //   "inferenceTimeout": 30000, // ms per judge request',
    '  //   testTimeout defaults to 30000 + 1000 per run after the first; set "testTimeout": <ms> to fix it',
    '  //   "strict": false, // true: extract() treats any hedge ("probably two") as null',
    '  // },',
    '}',
    '',
  ];

  render(): string {
    return ConfigTemplate.LINES.join('\n');
  }
}

export { ConfigTemplate };
