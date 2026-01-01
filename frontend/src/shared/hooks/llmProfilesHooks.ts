import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "react-router-dom";
import {
  LLMProfilesApi,
  LLMProfile,
  LLMProfileRequest,
} from "@/shared/utils/llmProfilesApi";
import { log } from "@/shared/utils/clientLogger";

/**
 * Custom hooks for LLM profiles management
 */

/**
 * Hook to fetch all LLM profiles for the current user
 * Optimized for idempotency and controlled fetching - executes on strands and settings routes
 * @returns Query result with profiles data
 */
export const useLLMProfiles = () => {
  const location = useLocation();
  const [profiles, setProfiles] = useState<LLMProfile[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  // Use ref flags to prevent re-fetches between route redraws
  const hasFetchedOnce = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const shouldFetch = useCallback(() => {
    // Fetch on both `/strands` and `/settings` pages
    return (
      location.pathname.startsWith("/strands") ||
      location.pathname.startsWith("/settings")
    );
  }, [location.pathname]);

  const fetchProfiles = useCallback(
    async (forceRefresh = false) => {
      if (!shouldFetch()) {
        log.debug("Skipping fetch - not on strands or settings route");
        return;
      }

      if (!forceRefresh && hasFetchedOnce.current) {
        log.debug(
          "Skipping redundant fetch — already fetched on this session."
        );
        return;
      }

      // Cancel any pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      hasFetchedOnce.current = true;
      setLoading(true);
      abortControllerRef.current = new AbortController();

      log.info("Fetching profiles for current session…");
      try {
        const response = await LLMProfilesApi.getProfiles();
        setProfiles(response.profiles || []);
        setError(null);
        log.info(`Loaded ${response.profiles?.length || 0} profiles.`);
      } catch (err) {
        // Don't set error if request was aborted
        if (err instanceof Error && err.name === "AbortError") {
          log.debug("Request aborted");
          return;
        }

        const normalizedError =
          err instanceof Error ? err : new Error(String(err));
        // @ts-ignore - Logger type mismatch
        // @ts-ignore
        log.error("Failed to load profiles:", normalizedError.message);
        setError(normalizedError);
      } finally {
        setLoading(false);
      }
    },
    [shouldFetch]
  );

  // Strict effect lifecycle: runs only when route changes to strands or settings
  useEffect(() => {
    if (shouldFetch()) {
      fetchProfiles();
    }

    // Cleanup any pending requests when component unmounts
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [shouldFetch, fetchProfiles]);

  return {
    profiles,
    loading,
    error,
    refetch: () => fetchProfiles(true),
  };
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
