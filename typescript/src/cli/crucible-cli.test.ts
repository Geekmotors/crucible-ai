import { describe, expect, it } from '@jest/globals';
import { ExitCode } from './exit-code.enum.js';
import { CliArgument } from './test/cli-argument.enum.js';
import { CliHarness } from './test/cli-harness.util.js';
import { InitProviderName } from './test/init-provider-name.enum.js';
import { TemplateHarness } from './test/template-harness.util.js';
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

  it('init with no provider writes the openrouter config', () => {
    const { files } = CliHarness.run([CliArgument.Init]);
    expect(files.contents()).toEqual({
      [ConfigFileName.Jsonc]: TemplateHarness.generatedFor(InitProviderName.OpenRouter),
    });
  });

  it.each([
    InitProviderName.OpenRouter,
    InitProviderName.OpenAi,
    InitProviderName.OpenAiCompatible,
  ])('init --provider %s writes the config for that provider', (provider) => {
    const { files } = CliHarness.run([CliArgument.Init, CliArgument.Provider, provider]);
    expect(files.contents()).toEqual({
      [ConfigFileName.Jsonc]: TemplateHarness.generatedFor(provider),
    });
  });

  it('init --provider=<name> writes the config for that provider', () => {
    const { files } = CliHarness.run([
      CliArgument.Init,
      `${CliArgument.Provider}=${InitProviderName.OpenAi}`,
    ]);
    expect(files.contents()).toEqual({
      [ConfigFileName.Jsonc]: TemplateHarness.generatedFor(InitProviderName.OpenAi),
    });
  });

  it.each([
    ['no command', []],
    ['an unknown command', [CliArgument.Unknown]],
    ['init with a surplus argument', [CliArgument.Init, CliArgument.Unknown]],
    ['init with an unknown flag', [CliArgument.Init, CliArgument.UnknownFlag]],
    ['init --provider with no name', [CliArgument.Init, CliArgument.Provider]],
    [
      'init --provider with a provider init does not offer',
      [CliArgument.Init, CliArgument.Provider, InitProviderName.Unknown],
    ],
    [
      'init --provider=<name> with a provider init does not offer',
      [CliArgument.Init, `${CliArgument.Provider}=${InitProviderName.Unknown}`],
    ],
    [
      'init --provider given twice',
      [
        CliArgument.Init,
        CliArgument.Provider,
        InitProviderName.OpenAi,
        CliArgument.Provider,
        InitProviderName.OpenAi,
      ],
    ],
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

  it('writes nothing for a provider init does not offer', () => {
    const args = [CliArgument.Init, CliArgument.Provider, InitProviderName.Unknown];
    expect(CliHarness.run(args).files.contents()).toEqual({});
  });
});
