/**
 * Returns the API base URL from Vite env.
 * This file should only be imported in Vite/browser builds, never in Node/Jest.
 */
export function getApiBase(): string {
  const apiEndpoint = import.meta.env.VITE_API_ENDPOINT;

  console.log("[getApiBase] VITE_API_ENDPOINT:", apiEndpoint);

  if (!apiEndpoint) {
    console.error("[getApiBase] ERROR: VITE_API_ENDPOINT is not set");
    throw new Error("VITE_API_ENDPOINT environment variable is not set");
  }

  // If we're in the browser, replace localhost with the actual hostname
  // This handles the case where the frontend is running in a container
  // but the browser is accessing it from outside
  if (
    typeof window !== "undefined" &&
    window.location.hostname !== "localhost" &&
    apiEndpoint.includes("localhost")
  ) {
    const newEndpoint = apiEndpoint.replace(
      "localhost",
      window.location.hostname
    );
    console.log(`[getApiBase] Replacing ${apiEndpoint} with ${newEndpoint}`);
    return newEndpoint;
  }

  console.log("[getApiBase] Using API endpoint:", apiEndpoint);
  return apiEndpoint as string;
}
