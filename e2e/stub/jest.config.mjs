const config = {
  rootDir: '..',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/stub/runner/**/*.test.ts', '<rootDir>/stub/projects/*.test.ts'],
  testTimeout: 120000,
  maxWorkers: 1,
  setupFilesAfterEnv: ['<rootDir>/stub/stub-judge.lifecycle.ts'],
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  moduleFileExtensions: ['ts', 'cts', 'js', 'cjs', 'json'],
  transform: {
    '^.+\\.c?ts$': ['ts-jest', { useESM: true, tsconfig: '<rootDir>/tsconfig.json' }],
  },
};

export default config;
