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

  static run(project: string, environment: Record<string, string> = {}): Promise<JestOutcome> {
    const projectDir = fileURLToPath(
      new URL(`ext/fixtures/projects/${project}/`, JestProcess.e2eRoot),
    );
    const args = [
      JestProcess.jestBin,
      '--config',
      JestProcess.jestConfig,
      '--ci',
      '--testMatch',
      `**/projects/${project}/*.scenario.ts`,
    ];
    return new Promise((resolve) => {
      execFile(
        process.execPath,
        args,
        { cwd: projectDir, env: { ...process.env, ...environment } },
        (error, stdout, stderr) =>
          resolve({ exitCode: JestProcess.exitCode(error), output: `${stdout}${stderr}` }),
      );
    });
  }

  static revealsApiKey(output: string): boolean {
    const key = process.env.OPENROUTER_API_KEY?.trim();
    return key !== undefined && key !== '' && output.includes(key);
  }

  private static exitCode(error: ExecFileException | null): number {
    if (error === null) {
      return 0;
    }
    return typeof error.code === 'number' ? error.code : 1;
  }
}

export { JestProcess };
