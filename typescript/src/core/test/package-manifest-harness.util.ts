import { PackageManifest } from '../package-manifest.js';
import { StampSource } from './stamp-source.enum.js';

class PackageManifestHarness {
  static rootDir = '/pkg';

  static manifest(files: Record<string, string>): PackageManifest {
    return new PackageManifest(PackageManifestHarness.rootDir, (path) => {
      const text = files[path];
      if (text === undefined) {
        throw new Error('ENOENT');
      }
      return text;
    });
  }

  static published(): PackageManifest {
    return PackageManifestHarness.manifest({
      [`${PackageManifestHarness.rootDir}/package.json`]: JSON.stringify({
        name: StampSource.Package,
        version: StampSource.Version,
        type: 'module',
      }),
    });
  }
}

export { PackageManifestHarness };
