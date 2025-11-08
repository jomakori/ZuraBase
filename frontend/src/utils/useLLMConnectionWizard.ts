import { useState, useCallback, useEffect } from "react";
import {
  useTestLLMConnection,
  useCreateLLMProfile,
  useUpdateLLMProfile,
} from "./llmProfilesHooks";
import {
  LLMProfileRequest,
  getAvailableModels,
  fetchModelsFromLangChain,
} from "./llmProfilesApi";

export interface LLMConnectionWizardState {
  formData: Partial<LLMProfileRequest> & { id?: string };
  formErrors: { [key: string]: string };
  connectionTested: boolean;
  connectionSuccess: boolean | null;
  connectionMessage: string | null;
  availableModels: string[];
  loadingModels: boolean;
  modelsError: string | null;
}

export interface LLMConnectionWizardActions {
  handleChange: (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => void;
  handleTestConnection: () => Promise<void>;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  validateForm: () => boolean;
  resetForm: () => void;
  setFormData: (data: Partial<LLMProfileRequest> & { id?: string }) => void;
  loadModels: () => Promise<void>;
}

export interface UseLLMConnectionWizardOptions {
  initialData?: Partial<LLMProfileRequest> & { id?: string };
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Reusable hook for LLM connection wizard logic
 * Centralizes connection testing, model loading, and profile management
 */
export const useLLMConnectionWizard = (
  options: UseLLMConnectionWizardOptions = {}
): [LLMConnectionWizardState, LLMConnectionWizardActions, boolean] => {
  const { initialData, onSuccess, onError } = options;

  const [formData, setFormData] = useState<
    Partial<LLMProfileRequest> & { id?: string }
  >(
    initialData || {
      name: "",
      server_url: "",
      api_key: "",
      model: "",
      is_default: false,
    }
  );

  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [connectionTested, setConnectionTested] = useState(false);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelsError, setModelsError] = useState<string | null>(null);

  const {
    testConnection,
    loading: testingConnection,
    testResult,
  } = useTestLLMConnection();

  const { createProfile, loading: creating } = useCreateLLMProfile();
  const { updateProfile, loading: updating } = useUpdateLLMProfile();

  const connectionSuccess = testResult?.success ?? null;
  const connectionMessage = testResult?.message ?? null;

  const loadModels = useCallback(async () => {
    console.log("loadModels called. loadingModels:", loadingModels);
    if (loadingModels) return; // Prevent duplicate calls
    setLoadingModels(true);
    setModelsError(null);
    try {
      console.log("Attempting to fetch available models...");

      let result;
      const service = formData.service || "openai";
      const apiKey = formData.api_key || "";
      const serverURL = formData.server_url || "";

      if (!apiKey) {
        throw new Error("API key is required to fetch models");
      }

      if (formData.id) {
        // For existing profiles, use the standard endpoint (which will use the stored API key)
        console.log(
          "Fetching models for existing profile via backend proxy..."
        );
        result = await getAvailableModels();
      } else {
        // For new profiles, pass the API key and server URL to the backend proxy
        console.log(
          "Fetching models for new profile via backend proxy with provided API key and server URL..."
        );
        result = await getAvailableModels(apiKey, serverURL, service);
      }

      console.log("getAvailableModels result:", result);

      // Parse models from different possible response structures
      let parsed: string[] = [];
      if (result?.data && Array.isArray(result.data)) {
        parsed = result.data.map((m: any) => m.id || m);
      } else if (result?.models && Array.isArray(result.models)) {
        parsed = result.models.map((m: any) => m.id || m);
      } else if (Array.isArray(result)) {
        parsed = result.map((m: any) => m.id || m);
      } else if (result && typeof result === "object") {
        // Try to extract models from nested structure
        const allKeys = Object.keys(result);
        for (const key of allKeys) {
          if (Array.isArray(result[key])) {
            parsed = result[key].map((m: any) => m.id || m);
            break;
          }
        }
      }

      console.log("Parsed models:", parsed);

      if (parsed.length === 0) {
        setAvailableModels([]);
        setModelsError(
          "No models were returned from the server. The response structure may be unexpected."
        );
        console.log("No models returned, setting error.");
      } else {
        setAvailableModels(parsed);
        console.log("Models populated:", parsed);
      }
    } catch (err: any) {
      console.error("Failed to load models:", err);
      setAvailableModels([]);
      setModelsError(
        err?.message || "Failed to fetch models. Please verify the connection."
      );
      console.log("Error loading models, setting error and clearing list.");
    } finally {
      setLoadingModels(false);
      console.log("loadModels finished. loadingModels set to false.");
    }
  }, [loadingModels, formData.id, formData.service, formData.api_key]);

  // Don't automatically load models - we'll handle this manually in the wizard
  // when the user explicitly wants to see available models

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
      const { name, value, type } = e.target;
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({
        ...prev,
        [name]: type === "checkbox" ? checked : value,
      }));
      setFormErrors((prev) => ({ ...prev, [name]: "" }));
    },
    []
  );

  const validateForm = useCallback(() => {
    const errors: { [key: string]: string } = {};

    if (!formData.name) {
      errors.name = "Profile name is required.";
    }

    if (!formData.api_key && !formData.id) {
      errors.api_key = "API key is required.";
    }

    if (formData.server_url && !/^https?:\/\/.+/.test(formData.server_url)) {
      errors.server_url = "Invalid URL format (e.g., https://api.openai.com).";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [formData]);

  const handleTestConnection = useCallback(async () => {
    if (!formData.api_key) {
      setFormErrors((prev) => ({
        ...prev,
        api_key: "API key is required to test connection.",
      }));
      return;
    }

    try {
      const result = await testConnection(
        formData.server_url || "",
        formData.api_key
      );
      setConnectionTested(true);

      // Only auto-load models if connection success is true in the test result
      if (result?.success) {
        console.log("Test connection success, fetching available models...");
        await loadModels();
      } else {
        console.warn("Test connection failed, skipping model fetch.");
      }
    } catch (err: any) {
      console.error("Error during connection test:", err);
      setConnectionTested(false);
      setModelsError(
        "Failed to test connection. Please confirm your API key or network access."
      );
      if (onError) onError(err instanceof Error ? err : new Error(String(err)));
    }
  }, [
    formData.api_key,
    formData.server_url,
    testConnection,
    onError,
    loadModels,
  ]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      if (!validateForm()) {
        return;
      }

      try {
        if (formData.id) {
          // Update existing profile
          await updateProfile(formData.id, {
            name: formData.name,
            server_url: formData.server_url,
            api_key: formData.api_key,
            model: formData.model,
            is_default: formData.is_default,
          });
        } else {
          // Create new profile
          await createProfile({
            name: formData.name ?? "",
            server_url: formData.server_url ?? "",
            api_key: formData.api_key ?? "",
            model: formData.model ?? "",
            is_default: formData.is_default ?? false,
          });
        }

        if (onSuccess) {
          onSuccess();
        }
      } catch (err) {
        console.error("Failed to save LLM profile:", err);
        setFormErrors({ submit: "Failed to save profile. Please try again." });
        if (onError) {
          onError(err instanceof Error ? err : new Error(String(err)));
        }
      }
    },
    [formData, validateForm, createProfile, updateProfile, onSuccess, onError]
  );

  const resetForm = useCallback(() => {
    setFormData(
      initialData || {
        name: "",
        server_url: "",
        api_key: "",
        model: "",
        is_default: false,
      }
    );
    setFormErrors({});
    setConnectionTested(false);
    setAvailableModels([]);
    setModelsError(null);
  }, [initialData]);

  const state: LLMConnectionWizardState = {
    formData,
    formErrors,
    connectionTested,
    connectionSuccess,
    connectionMessage,
    availableModels,
    loadingModels,
    modelsError,
  };

  const actions: LLMConnectionWizardActions = {
    handleChange,
    handleTestConnection,
    handleSubmit,
    validateForm,
    resetForm,
    setFormData,
    loadModels,
  };

  const loading = testingConnection || creating || updating;

  return [state, actions, loading];
};
