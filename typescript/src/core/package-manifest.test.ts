import { describe, expect, it } from '@jest/globals';
import { SchemaSourceHarness } from './test/schema-source-harness.util.js';
import { PackageManifestHarness } from './test/package-manifest-harness.util.js';
import { StampSource } from './test/stamp-source.enum.js';

describe('PackageManifest', () => {
  it('reads the package name and version from the package root', () => {
    expect(PackageManifestHarness.published().identity()).toEqual({
      name: StampSource.Package,
      version: StampSource.Version,
    });
  });

  it('a missing package.json is a config failure', () => {
    const manifest = PackageManifestHarness.manifest({});
    expect(SchemaSourceHarness.errorKind(() => manifest.identity())).toBe('config');
  });

  it('a package.json without a name and version is a config failure', () => {
    const manifest = PackageManifestHarness.manifest({
      [`${PackageManifestHarness.rootDir}/package.json`]: '{"name": 1}',
    });
    expect(SchemaSourceHarness.errorKind(() => manifest.identity())).toBe('config');
  });
});
