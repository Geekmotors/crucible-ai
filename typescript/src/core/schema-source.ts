import { join } from 'node:path';
import { CrucibleError } from './errors.js';
import { PackageRoot } from './package-root.js';

type SchemaFileReader = (path: string) => string;

class SchemaSource {
  private readonly cache = new Map<string, string>();

  constructor(
    private readonly rootDir: string = PackageRoot.dir(),
    private readonly readFile: SchemaFileReader = PackageRoot.readText,
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
