/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testRegex: '.*\\.spec\\.ts$',
  moduleNameMapper: {
    '^@sentinelx/shared$': '<rootDir>/../shared/src/index.ts',
  },
};
