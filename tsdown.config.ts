import { defineConfig } from 'tsdown';

export default defineConfig([
  {
    entry: ['src/index.ts', 'src/vitest.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    fixedExtension: false,
    external: ['vitest'],
  },
  {
    entry: ['src/cli.ts'],
    format: ['esm'],
    dts: false,
    clean: false,
    fixedExtension: false,
  },
]);
