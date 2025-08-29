/**
 * Returns the API base URL from Vite env.
 * This file should only be imported in Vite/browser builds, never in Node/Jest.
 */
export function getApiBase(): string {
  return import.meta.env.VITE_API_ENDPOINT as string;
}
