/**
 * Unified fetch wrapper for authenticated API requests.
 * Ensures DRY compliance across planner and notes modules.
 * Includes correlation ID for centralized logging.
 */
import { getApiBase } from "@/app/getApiBase";
import logger from "./clientLogger";

// Store correlation ID for consistent request tracking
let currentCorrelationId = logger.getCorrelationId();

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const correlationId = currentCorrelationId;
  const method = options.method || 'GET';
  
  // Log the request
  logger.apiRequest('API', method, endpoint, options.body);

  try {
    const response = await fetch(`${getApiBase()}${endpoint}`, {
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        "X-Correlation-ID": correlationId,
        ...(options.headers || {}),
      },
      ...options,
    });

    // Log the response
    logger.apiResponse('API', method, endpoint, response.status);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText);
    }

    return await response.json();
  } catch (error) {
    // Log the error
    logger.apiError('API', method, endpoint, error as Error);
    throw error;
  }
}

// Export function to update correlation ID
export function setCorrelationId(id: string): void {
  currentCorrelationId = id;
  logger.setCorrelationId(id);
}

// Export function to get current correlation ID
export function getCorrelationId(): string {
  return currentCorrelationId;
}
