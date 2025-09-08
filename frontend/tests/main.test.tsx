import React from "react";
import { render, screen } from "@testing-library/react";
import { act } from "react-dom/test-utils";
import "@testing-library/jest-dom";
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  jest,
} from "@jest/globals";

// Import shared utilities
import {
  mockRouter,
  mockGetApiBase,
  setupTest,
  teardownTest,
} from "./__mocks__/test-utils";
import {
  MockApp,
  MockNotesApp,
  MockPlannerApp,
} from "./__mocks__/component-mocks";

// Mock components using shared mocks
jest.mock("../src/components/App", () => MockApp);
jest.mock("../src/notes/NotesApp", () => ({ NotesApp: MockNotesApp }));
jest.mock("../src/planner/PlannerApp", () => ({ PlannerApp: MockPlannerApp }));

// Mock getApiBase
mockGetApiBase();

describe("Router Component", () => {
  beforeEach(() => {
    setupTest();
  });

  afterEach(() => {
    teardownTest();
  });

  const testCases = [
    { path: "/", testId: "mock-app", expectedText: "Mock App Component" },
    {
      path: "/notes",
      testId: "mock-notes-app",
      expectedText: "Mock Notes App Component",
    },
    {
      path: "/planner",
      testId: "mock-planner-app",
      expectedText: "Mock Planner App Component",
    },
  ];

  it.each(testCases)(
    "renders $testId for $path",
    ({ path, testId, expectedText }) => {
      mockRouter(path);

      jest.isolateModules(() => {
        const domClient = require("react-dom/client");
        const originalCreateRoot = domClient.createRoot;
        domClient.createRoot = () => ({
          render: () => null,
          unmount: () => null,
        });

        const { Router } = require("../src/main.tsx");

        act(() => {
          render(<Router />);
        });

        const component = screen.getByTestId(testId);
        expect(component).toBeInTheDocument();
        expect(component).toHaveTextContent(expectedText);

        domClient.createRoot = originalCreateRoot;
      });
    }
  );

  it("handles unknown routes by defaulting to App component", () => {
    mockRouter("/unknown-route");

    jest.isolateModules(() => {
      const domClient = require("react-dom/client");
      const originalCreateRoot = domClient.createRoot;
      domClient.createRoot = () => ({
        render: () => null,
        unmount: () => null,
      });

      const { Router } = require("../src/main.tsx");

      act(() => {
        render(<Router />);
      });

      const component = screen.getByTestId("mock-app");
      expect(component).toBeInTheDocument();
      expect(component).toHaveTextContent("Mock App Component");

      domClient.createRoot = originalCreateRoot;
    });
  });
});
