import { describe, expect, it } from '@jest/globals';
import { ExitCode } from './exit-code.enum.js';
import { CliArgument } from './test/cli-argument.enum.js';
import { CliHarness } from './test/cli-harness.util.js';
import { ConfigFileName } from '../core/test/config-file-name.enum.js';

describe('CrucibleCli', () => {
  it('init creates the config file', () => {
    const { files } = CliHarness.run([CliArgument.Init]);
    expect(files.exists(ConfigFileName.Jsonc)).toBe(true);
  });

  it.each([CliArgument.Help, CliArgument.ShortHelp, CliArgument.HelpWord])(
    '%s prints usage and succeeds',
    (argument) => {
      const { code, output } = CliHarness.run([argument]);
      expect({ code, printed: output.stdout !== '' }).toEqual({
        code: ExitCode.Success,
        printed: true,
      });
    },
  );

  it.each([
    ['no command', []],
    ['an unknown command', [CliArgument.Unknown]],
    ['init with a surplus argument', [CliArgument.Init, CliArgument.Unknown]],
  ])('%s prints usage to stderr and fails as a usage error', (_label, args) => {
    const { code, output } = CliHarness.run(args);
    expect({ code, printed: output.stderr !== '' }).toEqual({
      code: ExitCode.Usage,
      printed: true,
    });
  });

  it('writes nothing for an unknown command', () => {
    expect(CliHarness.run([CliArgument.Unknown]).files.contents()).toEqual({});
  });
});
