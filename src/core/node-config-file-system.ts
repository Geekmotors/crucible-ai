import { lstatSync, readFileSync } from 'node:fs';
import type { ConfigFileSystem } from './config-file-system.js';

class NodeConfigFileSystem implements ConfigFileSystem {
  readText(path: string): string {
    return readFileSync(path, 'utf8');
  }

  exists(path: string): boolean {
    try {
      return lstatSync(path, { throwIfNoEntry: false }) !== undefined;
    } catch {
      return false;
    }
  }
}

export { NodeConfigFileSystem };
