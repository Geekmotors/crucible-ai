import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ConfigBoundary, ConfigFileRead } from './config-boundary.js';

class FileSystemConfigBoundary implements ConfigBoundary {
  describeLocation(name: string): string {
    return join(process.cwd(), name);
  }

  readConfigFile(name: string): ConfigFileRead {
    try {
      return { found: true, raw: readFileSync(this.describeLocation(name), 'utf8') };
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code === 'ENOENT') {
        return { found: false, reason: 'missing' };
      }
      const detail = cause instanceof Error ? cause.message : String(cause);
      return { found: false, reason: 'unreadable', detail };
    }
  }

  readVerbosityOverride(): string | undefined {
    return process.env.CRUCIBLE_VERBOSE;
  }
}

export { FileSystemConfigBoundary };
