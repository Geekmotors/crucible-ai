import { execFileSync } from 'node:child_process';
import process from 'node:process';

class PackVerifier {
  static allowed = [
    /^package\.json$/,
    /^README\.md$/,
    /^CHANGELOG\.md$/,
    /^LICENSE$/,
    /^dist\/[\w.-]+\.(js|cjs|d\.ts|d\.cts)$/,
    /^schemas\/[\w-]+\.md$/,
    /^schemas\/[\w.-]+\.schema\.json$/,
  ];

  static required = [
    'package.json',
    'README.md',
    'CHANGELOG.md',
    'LICENSE',
    'dist/index.js',
    'dist/index.cjs',
    'dist/index.d.ts',
    'dist/index.d.cts',
    'dist/cli.js',
    'schemas/coherent.md',
    'schemas/extract.md',
    'schemas/crucible.config.schema.json',
  ];

  packedFiles() {
    const output = execFileSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
      encoding: 'utf8',
    });
    const [manifest] = JSON.parse(output);
    return manifest.files.map((file) => file.path);
  }

  problems(files) {
    const unexpected = files
      .filter((file) => !PackVerifier.allowed.some((pattern) => pattern.test(file)))
      .map((file) => `unexpected file in tarball: ${file}`);
    const missing = PackVerifier.required
      .filter((file) => !files.includes(file))
      .map((file) => `required file missing from tarball: ${file}`);
    return [...unexpected, ...missing];
  }

  run() {
    const files = this.packedFiles();
    const problems = this.problems(files);
    if (problems.length > 0) {
      process.stderr.write(`${problems.join('\n')}\n`);
      process.exitCode = 1;
      return;
    }
    process.stdout.write(
      `npm pack contents verified (${files.length} files):\n${files.join('\n')}\n`,
    );
  }
}

new PackVerifier().run();
