// Polyfill ResizeObserver for jsdom/headlessui tests
global.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
import "@testing-library/jest-dom";
// Ensure process.env.VITE_API_ENDPOINT is set for tests
// Mock getApiBase to avoid import.meta in tests
jest.mock("./getApiBase", () => ({
  getApiBase: () => "http://localhost:3000",
}));
process.env.VITE_API_ENDPOINT = "http://localhost:3000";

/**
 * Mock import.meta.env for Jest (Vite-style env variables)
 * This ensures code using import.meta.env.VITE_API_ENDPOINT works in tests.
 */
Object.defineProperty(globalThis, "import", {
  value: {
    meta: {
      env: {
        DEV: true,
        PROD: false,
        VITE_API_ENDPOINT: "http://localhost:3000", // Match the variable used in client.ts
      },
    },
  },
  writable: true,
});
