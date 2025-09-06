import React from "react";
import { render, screen } from "@testing-library/react";
import { act } from "react-dom/test-utils";
import "@testing-library/jest-dom"; // Import jest-dom for the custom matchers

// Mock the components that are rendered by the Router
jest.mock("../src/components/App", () => {
  return function MockApp() {
    return <div data-testid="mock-app">Mock App Component</div>;
  };
});

jest.mock("../src/notes/NotesApp", () => {
  return {
    NotesApp: function MockNotesApp() {
      return <div data-testid="mock-notes-app">Mock Notes App Component</div>;
    },
  };
});

jest.mock("../src/planner/PlannerApp", () => {
  return {
    PlannerApp: function MockPlannerApp() {
      return (
        <div data-testid="mock-planner-app">Mock Planner App Component</div>
      );
    },
  };
});

// Mock the getApiBase function to avoid environment variable issues
jest.mock("../src/getApiBase", () => ({
  getApiBase: jest.fn().mockReturnValue("http://test-api.example.com"),
}));

describe("Router Component", () => {
  // Save original properties
  const originalPathname = window.location.pathname;
  const originalOrigin = window.location.origin;
  const originalHref = window.location.href;

  beforeEach(() => {
    // Use Object.defineProperty to mock location properties
    Object.defineProperty(window, "location", {
      writable: true,
      value: {
        pathname: "/",
        origin: "http://localhost",
        href: "http://localhost/",
        search: "",
        hash: "",
      },
    });
  });

  afterEach(() => {
    // Restore original properties
    Object.defineProperty(window, "location", {
      writable: true,
      value: {
        pathname: originalPathname,
        origin: originalOrigin,
        href: originalHref,
        search: "",
        hash: "",
      },
    });
  });

  it("renders App component for the root path", () => {
    // Set the pathname to '/'
    Object.defineProperty(window, "location", {
      writable: true,
      value: {
        ...window.location,
        pathname: "/",
      },
    });

    // We need to use a dynamic import to ensure the Router is initialized with the correct pathname
    jest.isolateModules(() => {
      // Import the Router component
      const main = require("../src/main.tsx");
      const { Router } = main;

      render(<Router />);

      // Check that the App component is rendered
      const appComponent = screen.getByTestId("mock-app");
      expect(appComponent).toBeInTheDocument();
      expect(appComponent).toHaveTextContent("Mock App Component");
    });
  });

  it("renders NotesApp component for /notes path", () => {
    // Set the pathname to '/notes'
    Object.defineProperty(window, "location", {
      writable: true,
      value: {
        ...window.location,
        pathname: "/notes",
      },
    });

    jest.isolateModules(() => {
      // Import the Router component
      const main = require("../src/main.tsx");
      const { Router } = main;

      render(<Router />);

      // Check that the NotesApp component is rendered
      const notesAppComponent = screen.getByTestId("mock-notes-app");
      expect(notesAppComponent).toBeInTheDocument();
      expect(notesAppComponent).toHaveTextContent("Mock Notes App Component");
    });
  });

  it("renders PlannerApp component for /planner path", () => {
    // Set the pathname to '/planner'
    Object.defineProperty(window, "location", {
      writable: true,
      value: {
        ...window.location,
        pathname: "/planner",
      },
    });

    jest.isolateModules(() => {
      // Import the Router component
      const main = require("../src/main.tsx");
      const { Router } = main;

      render(<Router />);

      // Check that the PlannerApp component is rendered
      const plannerAppComponent = screen.getByTestId("mock-planner-app");
      expect(plannerAppComponent).toBeInTheDocument();
      expect(plannerAppComponent).toHaveTextContent(
        "Mock Planner App Component"
      );
    });
  });
});
