import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CrucibleError } from './errors.js';

class PackageRoot {
  static dir(): string {
    let dir = dirname(fileURLToPath(import.meta.url));
    while (!existsSync(join(dir, 'package.json'))) {
      const parent = dirname(dir);
      if (parent === dir) {
        throw new CrucibleError('config', 'Could not locate the crucible-ai package root.');
      }
      dir = parent;
    }
    return dir;
  }

  static readText(path: string): string {
    return readFileSync(path, 'utf8');
  }
}

export { PackageRoot };
