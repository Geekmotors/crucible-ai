import type { CliOutput } from './cli-output.js';

type TextSink = { write(text: string): unknown };

class StreamCliOutput implements CliOutput {
  constructor(
    private readonly stdout: TextSink,
    private readonly stderr: TextSink,
  ) {}

  out(text: string): void {
    this.stdout.write(text);
  }

  err(text: string): void {
    this.stderr.write(text);
  }
}

export { StreamCliOutput };
export type { TextSink };
