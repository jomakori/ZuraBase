import { searchPhoto } from "../src/client";
import { jest, describe, it, expect, beforeEach } from "@jest/globals";
import { mockGetApiBase } from "./__mocks__/test-utils";

// Mock getApiBase
mockGetApiBase();

// Import the mocked getApiBase
import { getApiBase } from "../src/getApiBase";

// Set up environment for tests
const TEST_API_ENDPOINT = "http://test-api.example.com";

beforeEach(() => {
  // Reset mocks before each test
  jest.resetModules();
  jest.clearAllMocks();
  
  // Set up default mock implementation
  (getApiBase as jest.Mock).mockImplementation(() => TEST_API_ENDPOINT);
});

describe("getApiBase", () => {
  it("should return the API endpoint", () => {
    expect(getApiBase()).toBe(TEST_API_ENDPOINT);
  });

  it("should return a custom API endpoint when configured", () => {
    const customEndpoint = "http://custom-api.example.com";
    (getApiBase as jest.Mock).mockReturnValueOnce(customEndpoint);
    
    expect(getApiBase()).toBe(customEndpoint);
  });
});

describe("API client - searchPhoto", () => {
  // Mock fetch
  let mockFetch: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
    global.fetch = mockFetch;
    mockFetch.mockClear();
  });

  it("should call fetch with the correct URL when searching for photos", async () => {
    // Mock a successful response
    const mockResponse = {
      ok: true,
      json: () => Promise.resolve({ photos: [] }),
      text: () => Promise.resolve(""),
    };

    mockFetch.mockResolvedValue(mockResponse as unknown as Response);

    // Call the searchPhoto function
    await searchPhoto("test query");

    // Check that fetch was called with the correct URL
    expect(mockFetch).toHaveBeenCalledWith(
      "http://test-api.example.com/images/test%20query"
    );
  });

  it("should throw an error when the API returns an error", async () => {
    // Mock an error response
    const mockResponse = {
      ok: false,
      text: () => Promise.resolve("API Error"),
    };

    mockFetch.mockResolvedValue(mockResponse);

    // Call the searchPhoto function and expect it to throw
    await expect(searchPhoto("test query")).rejects.toThrow("API Error");

    // Check that fetch was called
    expect(mockFetch).toHaveBeenCalled();
  });

  it("should handle network errors", async () => {
    // Mock a network error
    mockFetch.mockRejectedValue(new Error("Network error"));

    // Call the searchPhoto function and expect it to throw
    await expect(searchPhoto("test query")).rejects.toThrow("Network error");
  });

  it("should handle empty query strings", async () => {
    // Mock a successful response
    const mockResponse = {
      ok: true,
      json: () => Promise.resolve({ photos: [] }),
      text: () => Promise.resolve(""),
    };

    mockFetch.mockResolvedValue(mockResponse);

    // Call the searchPhoto function with empty query
    await searchPhoto("");

    // Check that fetch was called with the correct URL
    expect(mockFetch).toHaveBeenCalledWith(
      "http://test-api.example.com/images/"
    );
  });
});
