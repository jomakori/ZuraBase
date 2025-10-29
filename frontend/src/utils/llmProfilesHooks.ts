import { useState, useEffect, useCallback } from "react";
import {
  LLMProfilesApi,
  LLMProfile,
  LLMProfileRequest,
} from "./llmProfilesApi";

/**
 * Custom hooks for LLM profiles management
 */

/**
 * Hook to fetch all LLM profiles for the current user
 * @returns Query result with profiles data
 */
export const useLLMProfiles = () => {
  const [profiles, setProfiles] = useState<LLMProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchProfiles = useCallback(async () => {
    try {
      setLoading(true);
      const response = await LLMProfilesApi.getProfiles();
      setProfiles(response.profiles || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  return { profiles, loading, error, refetch: fetchProfiles };
};

/**
 * Hook to fetch a single LLM profile by ID
 * @param id The ID of the profile to fetch
 * @returns Query result with profile data
 */
export const useLLMProfile = (id: string) => {
  const [profile, setProfile] = useState<LLMProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        setLoading(true);
        const response = await LLMProfilesApi.getProfile(id);
        setProfile(response.profile || null);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [id]);

  return { profile, loading, error };
};

/**
 * Hook to create a new LLM profile
 * @returns Mutation functions and state for creating a profile
 */
export const useCreateLLMProfile = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [createdProfile, setCreatedProfile] = useState<LLMProfile | null>(null);

  const createProfile = useCallback(
    async (profileRequest: LLMProfileRequest) => {
      setLoading(true);
      setError(null);
      try {
        const response = await LLMProfilesApi.createProfile(profileRequest);
        setCreatedProfile(response.profile || null);
        return response;
      } catch (err) {
        const normalizedError =
          err instanceof Error ? err : new Error(String(err));
        setError(normalizedError);
        throw normalizedError;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { createProfile, loading, error, createdProfile };
};

/**
 * Hook to update an existing LLM profile
 * @returns Mutation functions and state for updating a profile
 */
export const useUpdateLLMProfile = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [updatedProfile, setUpdatedProfile] = useState<LLMProfile | null>(null);

  const updateProfile = useCallback(
    async (id: string, profileRequest: Partial<LLMProfileRequest>) => {
      setLoading(true);
      setError(null);
      try {
        const response = await LLMProfilesApi.updateProfile(id, profileRequest);
        setUpdatedProfile(response.profile || null);
        return response;
      } catch (err) {
        const normalizedError =
          err instanceof Error ? err : new Error(String(err));
        setError(normalizedError);
        throw normalizedError;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { updateProfile, loading, error, updatedProfile };
};

/**
 * Hook to delete an LLM profile
 * @returns Mutation functions and state for deleting a profile
 */
export const useDeleteLLMProfile = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  const deleteProfile = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      await LLMProfilesApi.deleteProfile(id);
      setSuccess(true);
    } catch (err) {
      const normalizedError =
        err instanceof Error ? err : new Error(String(err));
      setError(normalizedError);
      setSuccess(false);
      throw normalizedError;
    } finally {
      setLoading(false);
    }
  }, []);

  return { deleteProfile, loading, error, success };
};

/**
 * Hook to set a profile as default
 * @returns Mutation functions and state for setting default profile
 */
export const useSetDefaultLLMProfile = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [updatedProfile, setUpdatedProfile] = useState<LLMProfile | null>(null);

  const setDefaultProfile = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await LLMProfilesApi.setDefaultProfile(id);
      setUpdatedProfile(response.profile || null);
      return response;
    } catch (err) {
      const normalizedError =
        err instanceof Error ? err : new Error(String(err));
      setError(normalizedError);
      throw normalizedError;
    } finally {
      setLoading(false);
    }
  }, []);

  return { setDefaultProfile, loading, error, updatedProfile };
};

/**
 * Hook to test LLM connection
 * @returns Mutation functions and state for testing connection
 */
export const useTestLLMConnection = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message?: string;
  } | null>(null);

  const testConnection = useCallback(
    async (serverUrl: string, apiKey: string) => {
      setLoading(true);
      setError(null);
      setTestResult(null);
      try {
        const response = await LLMProfilesApi.testConnection({
          server_url: serverUrl,
          api_key: apiKey,
        });
        setTestResult({
          success: response.success,
          message: response.message,
        });
        return response;
      } catch (err) {
        const normalizedError =
          err instanceof Error ? err : new Error(String(err));
        setError(normalizedError);
        throw normalizedError;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { testConnection, loading, error, testResult };
};

/**
 * Hook to get the default LLM profile
 * @returns The default profile if available
 */
export const useDefaultLLMProfile = () => {
  const { profiles, loading, error } = useLLMProfiles();

  const defaultProfile = profiles.find((profile) => profile.is_default) || null;

  return { defaultProfile, loading, error };
};
