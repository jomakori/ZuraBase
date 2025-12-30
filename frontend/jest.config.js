/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  moduleNameMapper: {
    "\\.(css|less|scss|sass)$": "<rootDir>/src/__mocks__/styleMock.js",
    "^@milkdown/(.*)$": "<rootDir>/src/__mocks__/milkdownMock.tsx",
    "^./MarkdownEditor$": "<rootDir>/src/__mocks__/MarkdownEditor.tsx",
    // Mock import.meta.env for tests
    "^import\\.meta\\.env$": "<rootDir>/src/__mocks__/envMock.js",
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
  setupFilesAfterEnv: ["<rootDir>/src/setupTests.ts"],
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
};
