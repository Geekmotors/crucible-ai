import type { CliOutput } from './cli-output.js';
import { ConfigTemplate } from './config-template.util.js';
import { ExitCode } from './exit-code.enum.js';
import type { InitCommand } from './init-command.js';

class CrucibleCli {
  private static readonly HELP_ARGUMENTS = new Set(['--help', '-h', 'help']);
  private static readonly PROVIDER_FLAG = '--provider';
  private static readonly PROVIDER_ASSIGNMENT = `${CrucibleCli.PROVIDER_FLAG}=`;
  private static readonly USAGE = [
    'Usage: crucible-ai <command>',
    '',
    'Commands:',
    '  init [--provider <name>]',
    '          Write crucible.config.jsonc in the current directory, listing every',
    '          setting and its default. Does nothing if a config file already exists.',
    '          --provider: openrouter (the default), openai or openai-compatible.',
    '  help    Show this message (also --help or -h).',
    '',
  ].join('\n');

  constructor(
    private readonly init: InitCommand,
    private readonly output: CliOutput,
  ) {}

  run(args: readonly string[]): ExitCode {
    const [command, ...rest] = args;
    if (command !== undefined && CrucibleCli.HELP_ARGUMENTS.has(command)) {
      this.output.out(CrucibleCli.USAGE);
      return ExitCode.Success;
    }
    const template = command === 'init' ? this.initTemplate(rest) : undefined;
    if (template !== undefined) {
      return this.init.run(template);
    }
    this.output.err(CrucibleCli.USAGE);
    return ExitCode.Usage;
  }

  private initTemplate(options: readonly string[]): ConfigTemplate | undefined {
    const provider = this.providerOption(options);
    return provider === undefined ? undefined : ConfigTemplate.forProvider(provider);
  }

  private providerOption(options: readonly string[]): string | undefined {
    if (options.length === 0) {
      return ConfigTemplate.DEFAULT_PROVIDER;
    }
    const [first, second] = options;
    if (options.length === 1 && first.startsWith(CrucibleCli.PROVIDER_ASSIGNMENT)) {
      return first.slice(CrucibleCli.PROVIDER_ASSIGNMENT.length);
    }
    if (options.length === 2 && first === CrucibleCli.PROVIDER_FLAG) {
      return second;
    }
    return undefined;
  }
}

export { CrucibleCli };
