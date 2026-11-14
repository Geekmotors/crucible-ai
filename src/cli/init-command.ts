import { CONFIG_FILE_NAMES } from '../core/config-boundary.js';
import type { CliOutput } from './cli-output.js';
import { ConfigTemplate } from './config-template.util.js';
import { ExitCode } from './exit-code.enum.js';
import type { ProjectFiles } from './project-files.js';

class InitCommand {
  constructor(
    private readonly files: ProjectFiles,
    private readonly output: CliOutput,
    private readonly template: ConfigTemplate = new ConfigTemplate(),
  ) {}

  run(): ExitCode {
    const existing = CONFIG_FILE_NAMES.find((name) => this.files.exists(name));
    if (existing !== undefined) {
      return this.refuse(existing);
    }
    const name = ConfigTemplate.FILE_NAME;
    const creation = this.files.create(name, this.template.render());
    if (creation.created) {
      this.output.out(
        `Created ${this.files.describeLocation(name)}.\n` +
          `Set CRUCIBLE_JUDGE_KEY to your judge provider's API key, then run your tests.\n`,
      );
      return ExitCode.Success;
    }
    if (creation.reason === 'exists') {
      return this.refuse(name);
    }
    this.output.err(
      `Could not write ${this.files.describeLocation(name)} (${creation.detail ?? 'unknown cause'}).\n`,
    );
    return ExitCode.Failure;
  }

  private refuse(existing: string): ExitCode {
    this.output.err(
      `${this.files.describeLocation(existing)} already exists; nothing was changed. ` +
        `Edit it, or delete it and run init again.\n`,
    );
    return ExitCode.Failure;
  }
}

export { InitCommand };
