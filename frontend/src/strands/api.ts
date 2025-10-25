import { getApiBase } from "../getApiBase";
import {
  Strand,
  StrandRequest,
  StrandResponse,
  StrandQueryParams,
} from "./types";

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
    const response = await fetch(`${API_BASE}/strands/${id}`, {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch strand: ${response.statusText}`);
    }

    return await response.json();
  },

  /**
   * Create a new strand
   * @param strandRequest The strand data to create
   * @returns Promise with the created strand response
   */
  async createStrand(strandRequest: StrandRequest): Promise<StrandResponse> {
    const response = await fetch(`${API_BASE}/strands/ingest`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(strandRequest),
    });

    if (!response.ok) {
      throw new Error(`Failed to create strand: ${response.statusText}`);
    }

    return await response.json();
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
    const response = await fetch(`${API_BASE}/strands/${id}`, {
      method: "PUT",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(strandRequest),
    });

    if (!response.ok) {
      throw new Error(`Failed to update strand: ${response.statusText}`);
    }

    return await response.json();
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
