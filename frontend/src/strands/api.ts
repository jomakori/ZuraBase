import { getApiBase } from "../getApiBase";
import {
  Strand,
  StrandRequest,
  StrandResponse,
  StrandQueryParams,
  SyncResponse,
  SyncLog,
} from "./types";
import { handleAuthError } from "../utils/authRefresh";
import { log as logger } from "../utils/clientLogger";

const API_BASE = getApiBase();
const MODULE = "StrandsApi";

/**
 * API client for the Strands module
 * Uses centralized logger for consistent logging
 */
export const StrandsApi = {
  /**
   * Fetch all strands for the current user
   * @param params Query parameters for filtering and pagination
   * @returns Promise with the strands response
   */
  async getStrands(params?: StrandQueryParams): Promise<StrandResponse> {
    let url = `${API_BASE}/strands`;

    // Add query parameters if provided
    if (params) {
      const queryParams = new URLSearchParams();

      if (params.tags && params.tags.length > 0) {
        queryParams.set("tags", params.tags.join(","));
      }

      if (params.page) {
        queryParams.set("page", params.page.toString());
      }

      if (params.limit) {
        queryParams.set("limit", params.limit.toString());
      }

      const queryString = queryParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    logger.apiRequest(MODULE, "GET", url);
    const response = await fetch(url, {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      logger.apiResponse(MODULE, "GET", url, response.status);
      throw new Error(`Failed to fetch strands: ${response.statusText}`);
    }
    const data = await response.json();
    logger.apiResponse(MODULE, "GET", url, response.status, data);
    return data;
  },

  /**
   * Fetch a single strand by ID
   * @param id The ID of the strand to fetch
   * @returns Promise with the strand response
   */
  async getStrand(id: string): Promise<StrandResponse> {
    try {
      const url = `${API_BASE}/strands/${id}`;
      logger.apiRequest(MODULE, "GET", url);
      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          await handleAuthError(response.status);
        }

        const errorText = await response.text();
        logger.apiResponse(MODULE, "GET", url, response.status, {
          error: errorText,
        });
        throw new Error(
          `Failed to fetch strand: ${response.status} ${
            response.statusText
          } - ${errorText || "No response body"}`
        );
      }
      const data = await response.json();
      logger.apiResponse(MODULE, "GET", url, response.status, data);
      return data;
    } catch (err) {
      if (err instanceof TypeError && err.message.includes("Failed to fetch")) {
        logger.warn(
          MODULE,
          "Network error detected, server might be unavailable"
        );
      } else if (
        err instanceof TypeError &&
        err.message.includes("net::ERR_CONNECTION_REFUSED")
      ) {
        logger.warn(MODULE, "Connection refused, server might be restarting");
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      logger.apiError(MODULE, "GET", `${API_BASE}/strands/${id}`, err as Error);
      throw err;
    }
  },

  /**
   * Create a new strand
   * The strand will be saved immediately and queued for AI processing if available
   * @param strandRequest The strand data to create
   * @returns Promise with the created strand response
   */
  async createStrand(strandRequest: StrandRequest): Promise<StrandResponse> {
    try {
      const url = `${API_BASE}/strands`;
      logger.apiRequest(MODULE, "POST", url, strandRequest);
      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(strandRequest),
      });

      if (!response.ok) {
        const text = await response.text();
        logger.apiResponse(MODULE, "POST", url, response.status, {
          error: text,
        });
        throw new Error(
          `Failed to create strand: ${response.status} ${
            response.statusText
          } - ${text || "No response body"}`
        );
      }
      const data = await response.json();
      logger.apiResponse(MODULE, "POST", url, response.status, data);
      return data;
    } catch (err) {
      logger.apiError(MODULE, "POST", `${API_BASE}/strands`, err as Error);
      throw err;
    }
  },

  /**
   * Update an existing strand
   * @param id The ID of the strand to update
   * @param strandRequest The updated strand data
   * @returns Promise with the updated strand response
   */
  async updateStrand(
    id: string,
    strandRequest: StrandRequest
  ): Promise<StrandResponse> {
    try {
      const url = `${API_BASE}/strands/${id}`;
      logger.apiRequest(MODULE, "PUT", url, strandRequest);
      const response = await fetch(url, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(strandRequest),
      });

      if (!response.ok) {
        if (response.status === 401) {
          await handleAuthError(response.status);
        }

        const errorText = await response.text();
        logger.apiResponse(MODULE, "PUT", url, response.status, {
          error: errorText,
        });
        throw new Error(
          `Failed to update strand: ${response.status} ${
            response.statusText
          } - ${errorText || "No response body"}`
        );
      }
      const data = await response.json();
      logger.apiResponse(MODULE, "PUT", url, response.status, data);
      return data;
    } catch (err) {
      if (err instanceof TypeError && err.message.includes("Failed to fetch")) {
        logger.warn(
          MODULE,
          "Network error during strand update, server might be unavailable"
        );
      }
      logger.apiError(MODULE, "PUT", `${API_BASE}/strands/${id}`, err as Error);
      throw err;
    }
  },

  /**
   * Delete a strand
   * @param id The ID of the strand to delete
   * @returns Promise that resolves when the strand is deleted
   */
  async deleteStrand(id: string): Promise<void> {
    const url = `${API_BASE}/strands/${id}`;
    logger.apiRequest(MODULE, "DELETE", url);
    const response = await fetch(url, {
      method: "DELETE",
      credentials: "include",
    });

    if (!response.ok) {
      logger.apiResponse(MODULE, "DELETE", url, response.status);
      throw new Error(`Failed to delete strand: ${response.statusText}`);
    }
    logger.apiResponse(MODULE, "DELETE", url, response.status);
  },

  /**
   * Fetch all tags for the current user
   * @returns Promise with the tags response
   */
  async getTags(): Promise<string[]> {
    const url = `${API_BASE}/strands/tags`;
    logger.apiRequest(MODULE, "GET", url);
    const response = await fetch(url, {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      logger.apiResponse(MODULE, "GET", url, response.status);
      throw new Error(`Failed to fetch tags: ${response.statusText}`);
    }

    const data = await response.json();
    logger.apiResponse(MODULE, "GET", url, response.status, data);
    return data.tags || [];
  },

  /**
   * Sync a single strand with AI
   * @param id The ID of the strand to sync
   * @returns Promise with the sync response
   */
  async syncStrand(id: string): Promise<SyncResponse> {
    try {
      const url = `${API_BASE}/strands/${id}/sync`;
      logger.apiRequest(MODULE, "POST", url);
      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          await handleAuthError(response.status);
        }

        const errorText = await response.text();
        logger.apiResponse(MODULE, "POST", url, response.status, {
          error: errorText,
        });
        throw new Error(
          `Failed to sync strand: ${response.status} ${response.statusText} - ${
            errorText || "No response body"
          }`
        );
      }
      const data = await response.json();
      logger.apiResponse(MODULE, "POST", url, response.status, data);
      return data;
    } catch (err) {
      if (err instanceof TypeError && err.message.includes("Failed to fetch")) {
        logger.warn(
          MODULE,
          "Network error during strand sync, server might be unavailable"
        );
      }
      logger.apiError(
        MODULE,
        "POST",
        `${API_BASE}/strands/${id}/sync`,
        err as Error
      );
      throw err;
    }
  },

  /**
   * Get sync history for a strand
   * @param strandId The ID of the strand
   * @returns Promise with the sync history
   */
  async getStrandHistory(
    strandId: string
  ): Promise<{ sync_history: SyncLog[] }> {
    try {
      const url = `${API_BASE}/strands/${strandId}/sync-history`;
      logger.apiRequest(MODULE, "GET", url);
      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          await handleAuthError(response.status);
        }

        const errorText = await response.text();
        logger.apiResponse(MODULE, "GET", url, response.status, {
          error: errorText,
        });
        throw new Error(
          `Failed to fetch sync history: ${response.status} ${
            response.statusText
          } - ${errorText || "No response body"}`
        );
      }
      const data = await response.json();
      logger.apiResponse(MODULE, "GET", url, response.status, data);
      return data;
    } catch (err) {
      logger.apiError(
        MODULE,
        "GET",
        `${API_BASE}/strands/${strandId}/sync-history`,
        err as Error
      );
      throw err;
    }
  },

  /**
   * Rollback a strand to a previous sync version
   * @param strandId The ID of the strand
   * @param timestamp The timestamp of the sync log to rollback to
   * @returns Promise with the updated strand response
   */
  async rollbackStrand(
    strandId: string,
    timestamp: string
  ): Promise<StrandResponse> {
    try {
      const url = `${API_BASE}/strands/${strandId}/rollback`;
      logger.apiRequest(MODULE, "POST", url, { timestamp });
      const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ timestamp }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          await handleAuthError(response.status);
        }

        const errorText = await response.text();
        logger.apiResponse(MODULE, "POST", url, response.status, {
          error: errorText,
        });
        throw new Error(
          `Failed to rollback strand: ${response.status} ${
            response.statusText
          } - ${errorText || "No response body"}`
        );
      }
      const data = await response.json();
      logger.apiResponse(MODULE, "POST", url, response.status, data);
      return data;
    } catch (err) {
      if (err instanceof TypeError && err.message.includes("Failed to fetch")) {
        logger.warn(
          MODULE,
          "Network error during rollback, server might be unavailable"
        );
      }
      logger.apiError(
        MODULE,
        "POST",
        `${API_BASE}/strands/${strandId}/rollback`,
        err as Error
      );
      throw err;
    }
  },
};
