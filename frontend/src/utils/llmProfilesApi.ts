import { getApiBase } from "../getApiBase";
import { handleAuthError } from "./authRefresh";

export interface LLMProfile {
  id: string;
  user_id: string;
  name: string;
  server_url: string;
  model: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface LLMProfileRequest {
  name: string;
  server_url: string;
  api_key: string;
  model: string;
  is_default: boolean;
}

export interface LLMProfileResponse {
  profile?: LLMProfile;
  profiles?: LLMProfile[];
  error?: string;
}

export interface ConnectionTestRequest {
  server_url: string;
  api_key: string;
}

export interface ConnectionTestResponse {
  success: boolean;
  message?: string;
  error?: string;
}

const API_BASE = getApiBase();

/**
 * API client for LLM profiles
 */
export const LLMProfilesApi = {
  /**
   * Fetch all LLM profiles for the current user
   * @returns Promise with the profiles response
   */
  async getProfiles(): Promise<LLMProfileResponse> {
    try {
      const response = await fetch(`${API_BASE}/llm-profiles`, {
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
          `Failed to fetch LLM profiles: ${response.status} ${
            response.statusText
          } - ${errorText || "No response body"}`
        );
      }

      return await response.json();
    } catch (err) {
      console.error("Error fetching LLM profiles:", err);
      throw err;
    }
  },

  /**
   * Fetch a single LLM profile by ID
   * @param id The ID of the profile to fetch
   * @returns Promise with the profile response
   */
  async getProfile(id: string): Promise<LLMProfileResponse> {
    try {
      const response = await fetch(`${API_BASE}/llm-profiles/${id}`, {
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
          `Failed to fetch LLM profile: ${response.status} ${
            response.statusText
          } - ${errorText || "No response body"}`
        );
      }

      return await response.json();
    } catch (err) {
      console.error(`Error fetching LLM profile ${id}:`, err);
      throw err;
    }
  },

  /**
   * Create a new LLM profile
   * @param profileRequest The profile data to create
   * @returns Promise with the created profile response
   */
  async createProfile(
    profileRequest: LLMProfileRequest
  ): Promise<LLMProfileResponse> {
    try {
      const response = await fetch(`${API_BASE}/llm-profiles`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(profileRequest),
      });

      if (!response.ok) {
        // Handle authentication errors
        if (response.status === 401) {
          await handleAuthError(response.status);
        }

        const errorText = await response.text();
        throw new Error(
          `Failed to create LLM profile: ${response.status} ${
            response.statusText
          } - ${errorText || "No response body"}`
        );
      }

      return await response.json();
    } catch (err) {
      console.error("Error creating LLM profile:", err);
      throw err;
    }
  },

  /**
   * Update an existing LLM profile
   * @param id The ID of the profile to update
   * @param profileRequest The updated profile data
   * @returns Promise with the updated profile response
   */
  async updateProfile(
    id: string,
    profileRequest: Partial<LLMProfileRequest>
  ): Promise<LLMProfileResponse> {
    try {
      const response = await fetch(`${API_BASE}/llm-profiles/${id}`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(profileRequest),
      });

      if (!response.ok) {
        // Handle authentication errors
        if (response.status === 401) {
          await handleAuthError(response.status);
        }

        const errorText = await response.text();
        throw new Error(
          `Failed to update LLM profile: ${response.status} ${
            response.statusText
          } - ${errorText || "No response body"}`
        );
      }

      return await response.json();
    } catch (err) {
      console.error(`Error updating LLM profile ${id}:`, err);
      throw err;
    }
  },

  /**
   * Delete an LLM profile
   * @param id The ID of the profile to delete
   * @returns Promise that resolves when the profile is deleted
   */
  async deleteProfile(id: string): Promise<void> {
    try {
      const response = await fetch(`${API_BASE}/llm-profiles/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        // Handle authentication errors
        if (response.status === 401) {
          await handleAuthError(response.status);
        }

        const errorText = await response.text();
        throw new Error(
          `Failed to delete LLM profile: ${response.status} ${
            response.statusText
          } - ${errorText || "No response body"}`
        );
      }
    } catch (err) {
      console.error(`Error deleting LLM profile ${id}:`, err);
      throw err;
    }
  },

  /**
   * Set a profile as the default
   * @param id The ID of the profile to set as default
   * @returns Promise with the updated profile response
   */
  async setDefaultProfile(id: string): Promise<LLMProfileResponse> {
    try {
      const response = await fetch(
        `${API_BASE}/llm-profiles/${id}/set-default`,
        {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        // Handle authentication errors
        if (response.status === 401) {
          await handleAuthError(response.status);
        }

        const errorText = await response.text();
        throw new Error(
          `Failed to set default LLM profile: ${response.status} ${
            response.statusText
          } - ${errorText || "No response body"}`
        );
      }

      return await response.json();
    } catch (err) {
      console.error(`Error setting default LLM profile ${id}:`, err);
      throw err;
    }
  },

  /**
   * Test connection to an LLM server
   * @param testRequest The connection test request
   * @returns Promise with the test response
   */
  async testConnection(
    testRequest: ConnectionTestRequest
  ): Promise<ConnectionTestResponse> {
    try {
      const response = await fetch(`${API_BASE}/llm-profiles/test-connection`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(testRequest),
      });

      if (!response.ok) {
        // Handle authentication errors
        if (response.status === 401) {
          await handleAuthError(response.status);
        }

        const errorText = await response.text();
        throw new Error(
          `Failed to test LLM connection: ${response.status} ${
            response.statusText
          } - ${errorText || "No response body"}`
        );
      }

      return await response.json();
    } catch (err) {
      console.error("Error testing LLM connection:", err);
      throw err;
    }
  },
};

/**
 * Fetch available models from the user's default LLM profile.
 */
export async function getAvailableModels(): Promise<any> {
  const API_BASE = getApiBase();
  try {
    const response = await fetch(`${API_BASE}/llm-profiles/models`, {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to fetch models: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    return await response.json();
  } catch (error) {
    console.error("Error fetching available LLM models:", error);
    throw error;
  }
}
