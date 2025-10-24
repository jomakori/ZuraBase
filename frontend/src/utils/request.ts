/**
 * Unified fetch wrapper for authenticated API requests.
 * Ensures DRY compliance across planner and notes modules.
 */
import { getApiBase } from "../getApiBase";

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${getApiBase()}${endpoint}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return await response.json();
}
