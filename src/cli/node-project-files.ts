import { statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { FileCreation, ProjectFiles } from './project-files.js';

class NodeProjectFiles implements ProjectFiles {
  constructor(private readonly dir: string) {}

  describeLocation(name: string): string {
    return join(this.dir, name);
  }

  exists(name: string): boolean {
    try {
      return statSync(this.describeLocation(name), { throwIfNoEntry: false }) !== undefined;
    } catch {
      return true;
    }
  }

  create(name: string, content: string): FileCreation {
    try {
      writeFileSync(this.describeLocation(name), content, { encoding: 'utf8', flag: 'wx' });
      return { created: true };
    } catch (cause) {
      if ((cause as NodeJS.ErrnoException).code === 'EEXIST') {
        return { created: false, reason: 'exists' };
      }
      const detail = cause instanceof Error ? cause.message : String(cause);
      return { created: false, reason: 'unwritable', detail };
    }
  }
}

export { NodeProjectFiles };
