module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  coverageDirectory: 'coverage',
  globalTeardown: '<rootDir>/tests/teardown.ts',
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/server.ts',
    '!src/types/**/*.ts',
    '!src/db/seed.ts',
  ],
  testTimeout: 60000,
  coverageThreshold: {
    global: {
      branches: 35,
      functions: 60,
      lines: 60,
      statements: 60,
    },
  },
  verbose: true,
};