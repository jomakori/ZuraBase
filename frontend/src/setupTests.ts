// Polyfill ResizeObserver for jsdom/headlessui tests
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// Polyfill TextEncoder/TextDecoder for jsdom
import { TextEncoder, TextDecoder } from 'util';
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Polyfill fetch for tests that need it
if (!global.fetch) {
  global.fetch = jest.fn(() =>
    Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => '',
      blob: async () => new Blob(),
      headers: new Headers(),
    } as Response)
  ) as jest.Mock;
}

// Mock clientLogger to avoid import.meta issues
jest.mock("./utils/clientLogger", () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    getCorrelationId: jest.fn(() => "test-correlation-id"),
    flush: jest.fn(),
    apiRequest: jest.fn(),
    apiResponse: jest.fn(),
    apiError: jest.fn(),
  },
  log: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    getCorrelationId: jest.fn(() => "test-correlation-id"),
    flush: jest.fn(),
    apiRequest: jest.fn(),
    apiResponse: jest.fn(),
    apiError: jest.fn(),
  },
}));

// Mock react-markdown
jest.mock("react-markdown", () => ({
  __esModule: true,
  default: ({ children }: { children: string }) => children,
}));

import "@testing-library/jest-dom";

// Set process.env for Babel-transformed import.meta.env references
process.env.API_ENDPOINT = "http://localhost:3000";
process.env.MODE = "test";
process.env.DEV = "true";
process.env.PROD = "false";

// Mock getApiBase to avoid import.meta in tests
jest.mock("./getApiBase", () => ({
  getApiBase: () => "http://localhost:3000",
}));

/**
 * Mock import.meta.env for Jest (Vite-style env variables)
 * This ensures code using import.meta.env.API_ENDPOINT works in tests.
 * Note: Babel transforms import.meta.env to process.env in test mode.
 */
Object.defineProperty(globalThis, "import", {
  value: {
    meta: {
      env: {
        DEV: true,
        PROD: false,
        MODE: "test",
        API_ENDPOINT: "http://localhost:3000",
      },
    },
  },
  writable: true,
});
