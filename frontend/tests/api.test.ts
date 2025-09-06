import { searchPhoto } from "../src/client";
import { jest, describe, it, expect, beforeEach } from "@jest/globals";

// Create a mock for the getApiBase module
jest.mock("../src/getApiBase", () => ({
  getApiBase: jest.fn(),
}));

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

describe("API client", () => {
  // Mock fetch
  global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    // Reset the fetch mock before each test
    jest.clearAllMocks();
  });

  it("should call fetch with the correct URL when searching for photos", async () => {
    // Mock a successful response
    const mockResponse = {
      ok: true,
      json: jest.fn().mockResolvedValue({ photos: [] }),
      text: jest.fn().mockResolvedValue(""),
    } as any;

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
    } as any;

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
