import type { CliOutput } from '../cli-output.js';

class FakeCliOutput implements CliOutput {
  stdout = '';
  stderr = '';

  out(text: string): void {
    this.stdout += text;
  }

  err(text: string): void {
    this.stderr += text;
  }
}

export { FakeCliOutput };
