import { getApiBase } from "../getApiBase";
import { handleAuthError } from "./authRefresh";
import { log } from "./clientLogger";

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
  service?: string;
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
          const handled = await handleAuthError(response.status);
          if (handled) {
            throw new Error("Authentication required - please log in again");
          }
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
      log.error("Error fetching LLM profiles:", err);
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
          const handled = await handleAuthError(response.status);
          if (handled) {
            throw new Error("Authentication required - please log in again");
          }
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
      log.error(`Error fetching LLM profile ${id}:`, err);
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
          const handled = await handleAuthError(response.status);
          if (handled) {
            throw new Error("Authentication required - please log in again");
          }
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
      log.error("Error creating LLM profile:", err);
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
          const handled = await handleAuthError(response.status);
          if (handled) {
            throw new Error("Authentication required - please log in again");
          }
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
      log.error(`Error updating LLM profile ${id}:`, err);
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
          const handled = await handleAuthError(response.status);
          if (handled) {
            throw new Error("Authentication required - please log in again");
          }
        }

        const errorText = await response.text();
        throw new Error(
          `Failed to delete LLM profile: ${response.status} ${
            response.statusText
          } - ${errorText || "No response body"}`
        );
      }
    } catch (err) {
      log.error(`Error deleting LLM profile ${id}:`, err);
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
          const handled = await handleAuthError(response.status);
          if (handled) {
            throw new Error("Authentication required - please log in again");
          }
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
      log.error(`Error setting default LLM profile ${id}:`, err);
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
          const handled = await handleAuthError(response.status);
          if (handled) {
            throw new Error("Authentication required - please log in again");
          }
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
      log.error("Error testing LLM connection:", err);
      throw err;
    }
  },

  /**
   * Test connection to a stored LLM profile
   * @param id The ID of the profile to test
   * @returns Promise with the test response
   */
  async testStoredConnection(id: string): Promise<ConnectionTestResponse> {
    // Validate profile ID
    if (!id || id.trim() === "") {
      throw new Error("Profile ID is required for connection test");
    }

    try {
      log.debug(`Testing stored connection for profile: ${id}`);
      const response = await fetch(
        `${API_BASE}/llm-profiles/${id}/test-stored-connection`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        // Handle authentication errors
        if (response.status === 401) {
          const handled = await handleAuthError(response.status);
          if (handled) {
            throw new Error("Authentication required - please log in again");
          }
        }

        const errorText = await response.text();
        throw new Error(
          `Failed to test stored LLM connection: ${response.status} ${
            response.statusText
          } - ${errorText || "No response body"}`
        );
      }

      return await response.json();
    } catch (err) {
      log.error(`Error testing stored LLM connection for profile ${id}:`, err);
      throw err;
    }
  },
};

/**
 * Fetch available models from an LLM server using LangChain.
 * This is for existing profiles that have a default LLM profile.
 */
export async function getAvailableModels(
  apiKey?: string,
  serverURL?: string,
  service?: string
): Promise<any> {
  const API_BASE = getApiBase();
  try {
    // Always use the backend proxy route to ensure authentication and proper API key handling
    const queryParams = new URLSearchParams();
    if (apiKey) queryParams.append("apiKey", apiKey);
    if (serverURL) queryParams.append("serverURL", serverURL);
    if (service) queryParams.append("service", service);

    const url = `${API_BASE}/llm-profiles/models?${queryParams.toString()}`;

    log.debug("Fetching models via backend proxy:", url);

    const response = await fetch(url, {
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
    log.error("Error fetching available LLM models:", error);
    throw error;
  }
}

/**
 * Fetch available models directly from LangChain for new profile creation.
 * This doesn't require an existing default profile.
 */
export async function fetchModelsFromLangChain(
  service: string,
  apiKey: string,
  serverURL?: string
): Promise<any> {
  try {
    let baseUrl = "http://localhost:8000";
    if (serverURL && /^https?:\/\//.test(serverURL)) {
      baseUrl = serverURL.replace(/\/+$/, "");
    }

    const url = `${baseUrl}/api/v1/langchain/models?service=${encodeURIComponent(
      service
    )}`;

    log.debug("Fetching models from:", url);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Failed to fetch models from LangChain: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const result = await response.json();

    if (!result || (!result.models && !result.data)) {
      throw new Error(
        "Response from LangChain did not contain models or data."
      );
    }

    return {
      data: result.models || result.data || [],
      models: result.models || result.data || [],
    };
  } catch (error) {
    log.error("Error fetching models from LangChain:", error);
    throw error;
  }
}
