import { getApiBase } from "../getApiBase";
import {
  Strand,
  StrandRequest,
  StrandResponse,
  StrandQueryParams,
} from "./types";
import { handleAuthError, getNetworkErrorMessage } from "../utils/authRefresh";

const API_BASE = getApiBase();

/**
 * API client for the Strands module
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

    const response = await fetch(url, {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch strands: ${response.statusText}`);
    }

    return await response.json();
  },

  /**
   * Fetch a single strand by ID
   * @param id The ID of the strand to fetch
   * @returns Promise with the strand response
   */
  async getStrand(id: string): Promise<StrandResponse> {
    try {
      const response = await fetch(`${API_BASE}/strands/${id}`, {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        // Handle authentication errors
        if (response.status === 401) {
          await handleAuthError(response.status);
        }

        const errorText = await response.text();
        throw new Error(
          `Failed to fetch strand: ${response.status} ${
            response.statusText
          } - ${errorText || "No response body"}`
        );
      }

      return await response.json();
    } catch (err) {
      console.error(`Error in getStrand(${id}):`, err);

      // Check if it's a network error
      if (err instanceof TypeError && err.message.includes("Failed to fetch")) {
        console.warn("Network error detected, server might be unavailable");
      } else if (
        err instanceof TypeError &&
        err.message.includes("net::ERR_CONNECTION_REFUSED")
      ) {
        console.warn(
          "Connection refused error detected, server might be restarting"
        );
        // Wait a moment before propagating the error to allow server to restart
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      throw err;
    }
  },

  /**
   * Create a new strand
   * @param strandRequest The strand data to create
   * @returns Promise with the created strand response
   */
  /**
   * Create a new strand
   * The strand will be saved immediately and queued for AI processing if available
   * @param strandRequest The strand data to create
   * @returns Promise with the created strand response
   */
  async createStrand(strandRequest: StrandRequest): Promise<StrandResponse> {
    try {
      const response = await fetch(`${API_BASE}/strands`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(strandRequest),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(
          `Failed to create strand: ${response.status} ${
            response.statusText
          } - ${text || "No response body"}`
        );
      }

      return await response.json();
    } catch (err) {
      console.error("Error creating strand:", err);
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
      const response = await fetch(`${API_BASE}/strands/${id}`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(strandRequest),
      });

      if (!response.ok) {
        // Handle authentication errors
        if (response.status === 401) {
          await handleAuthError(response.status);
        }

        const errorText = await response.text();
        throw new Error(
          `Failed to update strand: ${response.status} ${
            response.statusText
          } - ${errorText || "No response body"}`
        );
      }

      return await response.json();
    } catch (err) {
      console.error(`Error in updateStrand(${id}):`, err);

      // Check if it's a network error
      if (err instanceof TypeError && err.message.includes("Failed to fetch")) {
        console.warn(
          "Network error detected during strand update, server might be unavailable"
        );
        // Show a user-friendly message
        alert(getNetworkErrorMessage(err));
      }

      throw err;
    }
  },

  /**
   * Delete a strand
   * @param id The ID of the strand to delete
   * @returns Promise that resolves when the strand is deleted
   */
  async deleteStrand(id: string): Promise<void> {
    const response = await fetch(`${API_BASE}/strands/${id}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (!response.ok) {
      throw new Error(`Failed to delete strand: ${response.statusText}`);
    }
  },

  /**
   * Fetch all tags for the current user
   * @returns Promise with the tags response
   */
  async getTags(): Promise<string[]> {
    const response = await fetch(`${API_BASE}/strands/tags`, {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch tags: ${response.statusText}`);
    }

    const data = await response.json();
    return data.tags || [];
  },
};
