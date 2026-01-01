/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  moduleNameMapper: {
    "\\.(css|less|scss|sass)$": "<rootDir>/src/shared/__mocks__/styleMock.js",
    "^@milkdown/(.*)$": "<rootDir>/src/shared/__mocks__/milkdownMock.tsx",
    "^./MarkdownEditor$": "<rootDir>/src/shared/__mocks__/MarkdownEditor.tsx",
    // Mock import.meta.env for tests
    "^import\\.meta\\.env$": "<rootDir>/src/shared/__mocks__/envMock.js",
    // Path aliases for new directory structure
    "^@/features/(.*)$": "<rootDir>/src/features/$1",
    "^@/shared/(.*)$": "<rootDir>/src/shared/$1",
    "^@/app/(.*)$": "<rootDir>/src/app/$1",
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        useESM: false,
        tsconfig: {
          jsx: "react-jsx",
          esModuleInterop: true,
          allowSyntheticDefaultImports: true,
          target: "ES2020",
          module: "commonjs",
        },
        babelConfig: true,
      },
    ],
  },
  transformIgnorePatterns: ["/node_modules/(?!(@milkdown|lodash-es|react-markdown)/)"],
  setupFilesAfterEnv: ["<rootDir>/src/app/setupTests.ts"],
  testEnvironmentOptions: {
    customExportConditions: ["node", "node-addons"],
  },
  reporters: [
    "default",
    [
      "jest-junit",
      {
        outputDirectory: "../test-results",
        outputName: "frontend-results.xml",
      },
    ],
  ],
  coveragePathIgnorePatterns: ["<rootDir>/src/client.ts"],
  // Test discovery patterns for nested __tests__ folders
  testMatch: [
    "<rootDir>/src/**/__tests__/**/*.{js,jsx,ts,tsx}",
    "<rootDir>/src/**/*.{spec,test}.{js,jsx,ts,tsx}"
  ],
};
