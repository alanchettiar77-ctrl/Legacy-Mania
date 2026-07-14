const nextJest = require("next/jest");

const createJestConfig = nextJest({ dir: "./" });

/** @type {import('jest').Config} */
const customJestConfig = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  testEnvironment: "jest-environment-jsdom",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  testPathIgnorePatterns: [
    "[\\\\/]\\.next[\\\\/]",
    "[\\\\/]node_modules[\\\\/]",
    "[\\\\/]e2e[\\\\/]",
    "[\\\\/]\\.claude[\\\\/]",
  ],
};

module.exports = createJestConfig(customJestConfig);
