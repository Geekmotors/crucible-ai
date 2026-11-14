const config = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/core/**/*.test.{ts,cts}'],
  testTimeout: 120000,
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
