import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CrucibleError } from './errors.js';

type SchemaFileReader = (path: string) => string;

class SchemaSource {
  private static readSchemaFile(path: string): string {
    return readFileSync(path, 'utf8');
  }

  private static packageRootDir(): string {
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

  private readonly cache = new Map<string, string>();

  constructor(
    private readonly rootDir: string = SchemaSource.packageRootDir(),
    private readonly readFile: SchemaFileReader = SchemaSource.readSchemaFile,
  ) {}

  load(name: string): string {
    const cached = this.cache.get(name);
    if (cached !== undefined) {
      return cached;
    }
    const path = join(this.rootDir, 'schemas', `${name}.md`);
    const text = this.readSchema(name, path);
    if (text.trim() === '') {
      throw new CrucibleError('config', `The "${name}" schema at ${path} is empty.`);
    }
    this.cache.set(name, text);
    return text;
  }

  private readSchema(name: string, path: string): string {
    try {
      return this.readFile(path);
    } catch (cause) {
      throw new CrucibleError('config', `Could not read the "${name}" schema at ${path}.`, {
        cause,
      });
    }
  }
}

export { SchemaSource };
export type { SchemaFileReader };
