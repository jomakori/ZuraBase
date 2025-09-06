import { getApiBase } from "../src/getApiBase";
import { searchPhoto } from "../src/client";

// Mock the import.meta.env object
// @ts-ignore - TypeScript doesn't recognize import.meta.env by default
const originalEnv = import.meta.env ? { ...import.meta.env } : {};

beforeEach(() => {
  // Reset the mocked environment before each test
  jest.resetModules();
  // @ts-ignore - Mocking import.meta.env
  import.meta.env = { ...originalEnv };
});

afterEach(() => {
  // Restore the original environment after each test
  // @ts-ignore - Restoring import.meta.env
  import.meta.env = originalEnv;
});

describe("getApiBase", () => {
  it("should throw an error when VITE_API_ENDPOINT is not set", () => {
    // @ts-ignore - Mocking import.meta.env
    import.meta.env.VITE_API_ENDPOINT = undefined;

    expect(() => getApiBase()).toThrow(
      "VITE_API_ENDPOINT environment variable is not set"
    );
  });

  it("should return the API endpoint when VITE_API_ENDPOINT is set", () => {
    const testEndpoint = "http://test-api.example.com";
    // @ts-ignore - Mocking import.meta.env
    import.meta.env.VITE_API_ENDPOINT = testEndpoint;

    expect(getApiBase()).toBe(testEndpoint);
  });
});

describe("API client", () => {
  // Mock fetch
  global.fetch = jest.fn();

  beforeEach(() => {
    // Reset the fetch mock before each test
    jest.clearAllMocks();

    // Set a test API endpoint
    // @ts-ignore - Mocking import.meta.env
    import.meta.env.VITE_API_ENDPOINT = "http://test-api.example.com";
  });

  it("should call fetch with the correct URL when searching for photos", async () => {
    // Mock a successful response
    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({ photos: [] }),
      text: jest.fn().mockResolvedValue(""),
    };

    // @ts-ignore - Mocking fetch
    global.fetch.mockResolvedValue(mockResponse);

    // Call the searchPhoto function
    await searchPhoto("test query");

    // Check that fetch was called with the correct URL
    expect(global.fetch).toHaveBeenCalledWith(
      "http://test-api.example.com/images/test%20query"
    );

    // Check that json() was called
    expect(mockResponse.json).toHaveBeenCalled();
  });

  it("should throw an error when the API returns an error", async () => {
    // Mock an error response
    const mockResponse = {
      ok: false,
      text: jest.fn().mockResolvedValue("API Error"),
    };

    // @ts-ignore - Mocking fetch
    global.fetch.mockResolvedValue(mockResponse);

    // Call the searchPhoto function and expect it to throw
    await expect(searchPhoto("test query")).rejects.toThrow("API Error");

    // Check that fetch was called
    expect(global.fetch).toHaveBeenCalled();

    // Check that text() was called
    expect(mockResponse.text).toHaveBeenCalled();
  });
});
