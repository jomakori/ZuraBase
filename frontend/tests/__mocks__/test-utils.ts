import { jest } from "@jest/globals";

// Mock getApiBase with configurable return value
export const mockGetApiBase = (endpoint = "http://test-api.example.com") => {
  jest.mock("../src/getApiBase", () => ({
    getApiBase: jest.fn().mockReturnValue(endpoint),
  }));
};

// Common test props and utilities
export const commonTestProps = {
  setOpen: jest.fn(),
  setContent: jest.fn(),
  setCoverImage: jest.fn(),
};

// Mock router utilities
export const mockRouter = (pathname = "/") => {
  Object.defineProperty(window, "location", {
    writable: true,
    value: {
      pathname,
      origin: "http://localhost",
      href: `http://localhost${pathname}`,
      search: "",
      hash: "",
    },
  });
};

// Mock React DOM utilities
export const mockReactDOM = () => {
  const domClient = require("react-dom/client");
  const originalCreateRoot = domClient.createRoot;

  return {
    mock: () => {
      domClient.createRoot = () => ({
        render: () => null,
        unmount: () => null,
      });
    },
    restore: () => {
      domClient.createRoot = originalCreateRoot;
    },
  };
};

// Test data factories
export const createMockNote = (overrides = {}) => ({
  id: "test-note-1",
  text: "Test note content",
  cover_url: "https://example.com/cover.jpg",
  ...overrides,
});

export const createMockPhoto = (overrides = {}) => ({
  id: 1,
  src: {
    medium: "medium.jpg",
    landscape: "landscape.jpg",
  },
  alt: "Nature",
  ...overrides,
});

// Setup and teardown utilities
export const setupTest = () => {
  // Clear all mocks
  jest.clearAllMocks();

  // Setup root element for React rendering
  const setupRoot = () => {
    let root = document.getElementById("root");
    if (!root) {
      root = document.createElement("div");
      root.setAttribute("id", "root");
      document.body.appendChild(root);
    }
    return root;
  };

  setupRoot();
};

export const teardownTest = () => {
  // Clean up DOM
  const root = document.getElementById("root");
  if (root) {
    document.body.removeChild(root);
  }
};
