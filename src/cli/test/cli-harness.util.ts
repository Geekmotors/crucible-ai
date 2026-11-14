import { CrucibleCli } from '../crucible-cli.js';
import { InitCommand } from '../init-command.js';
import { FakeCliOutput } from './cli-output.fake.js';
import { FakeProjectFiles } from './project-files.fake.js';

type CliRun = {
  code: number;
  files: FakeProjectFiles;
  output: FakeCliOutput;
};

class CliHarness {
  static run(args: string[], files: FakeProjectFiles = new FakeProjectFiles()): CliRun {
    const output = new FakeCliOutput();
    const code = new CrucibleCli(new InitCommand(files, output), output).run(args);
    return { code, files, output };
  }

  static init(files: FakeProjectFiles = new FakeProjectFiles()): CliRun {
    const output = new FakeCliOutput();
    const code = new InitCommand(files, output).run();
    return { code, files, output };
  }
}

export { CliHarness };
export type { CliRun };
