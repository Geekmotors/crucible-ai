import { basename } from 'node:path';
import type { ConfigFileSystem } from '../config-file-system.js';
import { ErrnoCode } from './errno-code.enum.js';

type ScriptedFile =
  { readonly text: string } | { readonly failure: ErrnoCode; readonly exists: boolean };

class ScriptedFileSystem implements ConfigFileSystem {
  constructor(private files: Record<string, ScriptedFile>) {}

  readText(path: string): string {
    const file = this.lookup(path);
    if ('text' in file) {
      return file.text;
    }
    throw Object.assign(new Error(file.failure), { code: file.failure });
  }

  exists(path: string): boolean {
    const file = this.lookup(path);
    return 'text' in file || file.exists;
  }

  private lookup(path: string): ScriptedFile {
    return this.files[basename(path)] ?? { failure: ErrnoCode.NotFound, exists: false };
  }
}

export { ScriptedFileSystem };
export type { ScriptedFile };
