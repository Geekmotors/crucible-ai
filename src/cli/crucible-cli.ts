import type { CliOutput } from './cli-output.js';
import { ExitCode } from './exit-code.enum.js';
import type { InitCommand } from './init-command.js';

class CrucibleCli {
  private static readonly HELP_ARGUMENTS = new Set(['--help', '-h', 'help']);
  private static readonly USAGE = [
    'Usage: crucible <command>',
    '',
    'Commands:',
    '  init    Write crucible.config.jsonc in the current directory, listing every',
    '          setting and its default. Does nothing if a config file already exists.',
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
    if (command === 'init' && rest.length === 0) {
      return this.init.run();
    }
    this.output.err(CrucibleCli.USAGE);
    return ExitCode.Usage;
  }
}

export { CrucibleCli };
