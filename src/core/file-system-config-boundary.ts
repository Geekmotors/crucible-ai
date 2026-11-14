import { join } from 'node:path';
import type { ConfigBoundary, ConfigFileRead } from './config-boundary.js';
import type { ConfigFileSystem } from './config-file-system.js';
import { NodeConfigFileSystem } from './node-config-file-system.js';

class FileSystemConfigBoundary implements ConfigBoundary {
  private static readonly ABSENT_CODES: ReadonlySet<string> = new Set(['ENOENT', 'ENOTDIR']);

  private static currentDirectory(): string {
    return process.cwd();
  }

  constructor(
    private readonly files: ConfigFileSystem = new NodeConfigFileSystem(),
    private readonly directory: () => string = FileSystemConfigBoundary.currentDirectory,
  ) {}

  describeLocation(name: string): string {
    return join(this.directory(), name);
  }

  readConfigFile(name: string): ConfigFileRead {
    const path = this.describeLocation(name);
    try {
      return { found: true, raw: this.files.readText(path) };
    } catch (cause) {
      if (this.isAbsent(path, cause)) {
        return { found: false, reason: 'missing' };
      }
      const detail = cause instanceof Error ? cause.message : String(cause);
      return { found: false, reason: 'unreadable', detail };
    }
  }

  readVerbosityOverride(): string | undefined {
    return process.env.CRUCIBLE_VERBOSE;
  }

  private isAbsent(path: string, cause: unknown): boolean {
    const code = (cause as NodeJS.ErrnoException | undefined)?.code;
    if (code !== undefined && FileSystemConfigBoundary.ABSENT_CODES.has(code)) {
      return true;
    }
    return !this.files.exists(path);
  }
}

export { FileSystemConfigBoundary };
