import { execFile } from 'node:child_process';
import type { ExecFileException } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { JestOutcome } from './jest-outcome.js';

class JestProcess {
  private static e2eRoot = new URL('../', import.meta.url);
  private static jestBin = fileURLToPath(
    new URL('../node_modules/jest/bin/jest.js', JestProcess.e2eRoot),
  );
  private static jestConfig = fileURLToPath(new URL('jest.config.mjs', JestProcess.e2eRoot));
  private static deadlineMs = 100000;
  private static outputBytes = 16 * 1024 * 1024;
  private static plainOutput = { FORCE_COLOR: '0', NO_COLOR: '1' };

  static run(
    project: string,
    environment: Record<string, string | undefined> = {},
  ): Promise<JestOutcome> {
    const projectDir = fileURLToPath(
      new URL(`stub/projects/fixtures/${project}/`, JestProcess.e2eRoot),
    );
    const args = [
      JestProcess.jestBin,
      '--config',
      JestProcess.jestConfig,
      '--ci',
      '--testMatch',
      `**/projects/fixtures/${project}/*.scenario.ts`,
    ];
    return new Promise((resolve) => {
      execFile(
        process.execPath,
        args,
        {
          cwd: projectDir,
          env: JestProcess.childEnvironment(environment),
          timeout: JestProcess.deadlineMs,
          killSignal: 'SIGKILL',
          maxBuffer: JestProcess.outputBytes,
        },
        (error, stdout, stderr) =>
          resolve({ exitCode: JestProcess.exitCode(error), output: `${stdout}${stderr}` }),
      );
    });
  }

  private static childEnvironment(
    environment: Record<string, string | undefined>,
  ): Record<string, string> {
    const merged: Record<string, string | undefined> = {
      ...process.env,
      ...JestProcess.plainOutput,
      ...environment,
    };
    return Object.fromEntries(
      Object.entries(merged).filter((entry): entry is [string, string] => entry[1] !== undefined),
    );
  }

  private static exitCode(error: ExecFileException | null): number {
    if (error === null) {
      return 0;
    }
    return typeof error.code === 'number' ? error.code : 1;
  }
}

export { JestProcess };
