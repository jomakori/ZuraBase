/**
 * Returns the API base URL from Vite env.
 * This file should only be imported in Vite/browser builds, never in Node/Jest.
 */
export function getApiBase(): string {
  const apiEndpoint = import.meta.env.API_ENDPOINT;

  if (!apiEndpoint) {
    throw new Error("API_ENDPOINT environment variable is not set");
  }

  // If we're in the browser, replace localhost with the actual hostname
  // This handles the case where the frontend is running in a container
  // but the browser is accessing it from outside
  let endpoint = apiEndpoint as string;
  if (
    typeof window !== "undefined" &&
    window.location.hostname !== "localhost" &&
    endpoint.includes("localhost")
  ) {
    endpoint = endpoint.replace(
      "localhost",
      window.location.hostname
    );
  }

  // Ensure the endpoint includes /api prefix for all API calls
  if (!endpoint.endsWith('/api')) {
    endpoint = endpoint.endsWith('/') ? `${endpoint}api` : `${endpoint}/api`;
  }

  return endpoint;
}
