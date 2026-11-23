import { join } from 'node:path';
import { CrucibleError } from './errors.js';
import { PackageRoot } from './package-root.js';

type PackageIdentity = {
  readonly name: string;
  readonly version: string;
};

type ManifestFileReader = (path: string) => string;

class PackageManifest {
  private cached?: PackageIdentity;

  constructor(
    private readonly rootDir: string = PackageRoot.dir(),
    private readonly readFile: ManifestFileReader = PackageRoot.readText,
  ) {}

  identity(): PackageIdentity {
    this.cached ??= this.read();
    return this.cached;
  }

  private read(): PackageIdentity {
    const path = join(this.rootDir, 'package.json');
    const { name, version } = this.parsed(path);
    if (typeof name !== 'string' || typeof version !== 'string') {
      throw new CrucibleError('config', `The package manifest at ${path} names no version.`);
    }
    return { name, version };
  }

  private parsed(path: string): { name?: unknown; version?: unknown } {
    try {
      return (JSON.parse(this.readFile(path)) ?? {}) as { name?: unknown; version?: unknown };
    } catch (cause) {
      throw new CrucibleError('config', `Could not read the package manifest at ${path}.`, {
        cause,
      });
    }
  }
}

export { PackageManifest };
export type { ManifestFileReader, PackageIdentity };
