import { describe, expect, it } from '@jest/globals';
import { ConfigTemplate } from './config-template.util.js';
import { ExitCode } from './exit-code.enum.js';
import { CliHarness } from './test/cli-harness.util.js';
import { ExistingConfig } from './test/existing-config.enum.js';
import { FakeProjectFiles } from './test/project-files.fake.js';
import { RacingProjectFiles } from './test/racing-project-files.fake.js';
import { ConfigFileName } from '../core/test/config-file-name.enum.js';

describe('InitCommand in a directory without a config file', () => {
  it('writes crucible.config.jsonc holding the commented template', () => {
    const { files } = CliHarness.init();
    expect(files.contents()).toEqual({ [ConfigFileName.Jsonc]: new ConfigTemplate().render() });
  });

  it('succeeds', () => {
    expect(CliHarness.init().code).toBe(ExitCode.Success);
  });

  it('fails when the file cannot be written', () => {
    expect(CliHarness.init(new FakeProjectFiles({}, false)).code).toBe(ExitCode.Failure);
  });
});

describe('InitCommand with a config file already present', () => {
  it.each([ConfigFileName.Json, ConfigFileName.Jsonc])('changes nothing when %s exists', (name) => {
    const existing = { [name]: ExistingConfig.Content };
    const { files } = CliHarness.init(new FakeProjectFiles(existing));
    expect(files.contents()).toEqual(existing);
  });

  it.each([ConfigFileName.Json, ConfigFileName.Jsonc])('fails when %s exists', (name) => {
    const { code } = CliHarness.init(new FakeProjectFiles({ [name]: ExistingConfig.Content }));
    expect(code).toBe(ExitCode.Failure);
  });

  it('explains the refusal on stderr', () => {
    const { output } = CliHarness.init(
      new FakeProjectFiles({ [ConfigFileName.Json]: ExistingConfig.Content }),
    );
    expect(output.stderr).not.toBe('');
  });
});

describe('InitCommand when a config file appears between its check and its write', () => {
  it('keeps the file that appeared', () => {
    const existing = { [ConfigFileName.Jsonc]: ExistingConfig.Content };
    const { files } = CliHarness.init(new RacingProjectFiles(existing));
    expect(files.contents()).toEqual(existing);
  });

  it('fails', () => {
    const racing = new RacingProjectFiles({ [ConfigFileName.Jsonc]: ExistingConfig.Content });
    expect(CliHarness.init(racing).code).toBe(ExitCode.Failure);
  });
});
