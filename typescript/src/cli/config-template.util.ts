import { CONFIG_FILE_NAMES } from '../core/config-boundary.js';

type JudgeChoice = {
  readonly lines: readonly string[];
  readonly nextStep: string;
};

class ConfigTemplate {
  static readonly FILE_NAME = CONFIG_FILE_NAMES[1];
  static readonly DEFAULT_PROVIDER = 'openrouter';

  private static readonly UNCHECKED_MODEL = [
    '',
    '  // Set "model" to the model id to judge with. Only anthropic/claude-haiku-5.5 on OpenRouter',
    "  // has been checked against Crucible's conformance cases. To check yours, see",
    '  // https://github.com/Geekmotors/crucible-ai/blob/main/docs/judge-models.md',
  ];

  private static readonly JUDGES: Readonly<Record<string, JudgeChoice>> = {
    openrouter: {
      lines: ['  "provider": "openrouter",', '  "model": "anthropic/claude-haiku-5.5",'],
      nextStep: 'Set CRUCIBLE_JUDGE_KEY to your OpenRouter API key, then run your tests.',
    },
    openai: {
      lines: [...ConfigTemplate.UNCHECKED_MODEL, '  "provider": "openai",', '  "model": "",'],
      nextStep:
        'Fill in "model", set CRUCIBLE_JUDGE_KEY to your OpenAI API key, then run your tests.',
    },
    'openai-compatible': {
      lines: [
        ...ConfigTemplate.UNCHECKED_MODEL,
        '  "provider": "openai-compatible",',
        '  "baseUrl": "", // the server\'s API root, e.g. "http://localhost:11434/v1" for Ollama',
        '  "model": "",',
      ],
      nextStep:
        'Fill in "baseUrl" and "model", set CRUCIBLE_JUDGE_KEY only if your server needs a ' +
        'key, then run your tests.',
    },
  };

  private static readonly HEADER = [
    '{',
    '  "$schema": "./node_modules/crucible-ai/schemas/crucible.config.schema.json",',
    '',
    '  // Judge provider: "openrouter", "openai" or "openai-compatible" (the last also needs',
    '  // a "baseUrl", e.g. "http://localhost:11434/v1"). The API key comes from the environment.',
  ];

  private static readonly SETTINGS = [
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

  static forProvider(provider: string): ConfigTemplate | undefined {
    const judge = Object.hasOwn(ConfigTemplate.JUDGES, provider)
      ? ConfigTemplate.JUDGES[provider]
      : undefined;
    return judge === undefined ? undefined : new ConfigTemplate(judge);
  }

  constructor(
    private readonly judge: JudgeChoice = ConfigTemplate.JUDGES[ConfigTemplate.DEFAULT_PROVIDER],
  ) {}

  render(): string {
    return [...ConfigTemplate.HEADER, ...this.judge.lines, ...ConfigTemplate.SETTINGS].join('\n');
  }

  nextStep(): string {
    return this.judge.nextStep;
  }
}

export { ConfigTemplate };
