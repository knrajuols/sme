/** @type {import('jest').Config} */
module.exports = {
  displayName: 'e2e',
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/tests/e2e/**/*.spec.ts'],
  moduleNameMapper: {
    '^@sme/(.*)$': '<rootDir>/libs/$1/src',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  testTimeout: 30000,
  verbose: true,
};
