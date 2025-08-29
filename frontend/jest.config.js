/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  moduleNameMapper: {
    "\\.(css|less|scss|sass)$": "<rootDir>/src/__mocks__/styleMock.js",
    "^@milkdown/(.*)$": "<rootDir>/src/__mocks__/milkdownMock.tsx",
    "^./App$": "<rootDir>/src/__mocks__/AppMock.tsx",
    "^../src/components/App$": "<rootDir>/src/__mocks__/AppMock.tsx",
    "^./MarkdownEditor$": "<rootDir>/src/__mocks__/MarkdownEditor.tsx",
  },
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        useESM: true,
        tsconfig: "tsconfig.json",
      },
    ],
  },
  transformIgnorePatterns: ["/node_modules/(?!(@milkdown|lodash-es)/)"],
  setupFilesAfterEnv: ["<rootDir>/src/setupTests.ts"],
  testEnvironmentOptions: {
    customExportConditions: ["node", "node-addons"],
  },
  extensionsToTreatAsEsm: [".ts", ".tsx"],
  reporters: [
    "default",
    [
      "jest-junit",
      { outputDirectory: "../test-results", outputName: "frontend-results.xml" },
    ],
  ],
  // Exclude client.ts from coverage to avoid import.meta issues in Jest
  coveragePathIgnorePatterns: ["<rootDir>/src/client.ts"],
};
