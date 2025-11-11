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
    if (loadingModels) {
      console.log("Already loading models, skipping duplicate call");
      return;
    }

    setLoadingModels(true);
    setModelsError(null);
    setAvailableModels([]); // Clear previous models

    try {
      console.log("Attempting to fetch available models...");

      const service = formData.service || "openai";
      const apiKey = formData.api_key || "";
      const serverURL = formData.server_url || "";

      if (!apiKey) {
        throw new Error("API key is required to fetch models");
      }

      let result;
      if (formData.id) {
        console.log(
          "Fetching models for existing profile via backend proxy..."
        );
        result = await getAvailableModels();
      } else {
        console.log("Fetching models for new profile:", { service, serverURL });
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
        throw new Error("No models were returned from the server");
      }

      setAvailableModels(parsed);
      console.log(`Successfully loaded ${parsed.length} models`);
    } catch (err: any) {
      console.error("Failed to load models:", err);
      setAvailableModels([]);
      setModelsError(
        err?.message || "Failed to fetch models. Please verify the connection."
      );
    } finally {
      setLoadingModels(false);
      console.log("loadModels finished");
    }
  }, [
    loadingModels,
    formData.id,
    formData.service,
    formData.api_key,
    formData.server_url,
  ]);

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

    // Validate profile name
    if (!formData.name) {
      errors.name = "Profile name is required.";
    } else if (formData.name.trim() === "") {
      errors.name = "Profile name cannot be empty or only whitespace.";
    } else if (formData.name.length > 100) {
      errors.name = "Profile name must be less than 100 characters.";
    }

    // Validate API key
    if (!formData.api_key && !formData.id) {
      errors.api_key = "API key is required.";
    } else if (formData.api_key && formData.api_key.length < 10) {
      errors.api_key =
        "API key appears to be too short (minimum 10 characters).";
    } else if (formData.api_key && formData.api_key.trim() === "") {
      errors.api_key = "API key cannot be empty or only whitespace.";
    }

    // Validate server URL
    if (formData.server_url) {
      if (!/^https?:\/\/.+/.test(formData.server_url)) {
        errors.server_url =
          "Invalid URL format. Must start with http:// or https:// (e.g., https://api.openai.com).";
      } else if (formData.server_url.length > 500) {
        errors.server_url = "Server URL must be less than 500 characters.";
      }
    }

    // Validate model name if provided
    if (formData.model && formData.model.length > 100) {
      errors.model = "Model name must be less than 100 characters.";
    } else if (formData.model && formData.model.trim() === "") {
      errors.model = "Model name cannot be empty or only whitespace.";
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

      // Load models only if connection was successful
      if (result?.success) {
        console.log("Connection test successful, loading models...");
        await loadModels();
      } else {
        // Connection test failed - clear models and let the UI show the error
        console.warn("Connection test failed:", result?.message);
        setAvailableModels([]);
      }
    } catch (err: any) {
      // Network or unexpected errors
      console.error("Connection test error:", err);
      setConnectionTested(true); // Mark as tested so error message shows
      setAvailableModels([]);
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
