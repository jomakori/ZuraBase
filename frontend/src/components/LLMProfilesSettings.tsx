import React, { useState, useEffect } from "react";
import {
  useLLMProfiles,
  useCreateLLMProfile,
  useUpdateLLMProfile,
  useDeleteLLMProfile,
  useSetDefaultLLMProfile,
  useTestLLMConnection,
} from "../utils/llmProfilesHooks";
import { LLMProfile, LLMProfileRequest } from "../utils/llmProfilesApi";
// Note: We're keeping the hook and API names the same to avoid breaking changes
// but updating the UI terminology to "AI" for better user understanding
import {
  Plus,
  PencilSimple,
  Trash,
  CheckCircle,
  XCircle,
  Star,
} from "@phosphor-icons/react";

const AIProfilesSettings: React.FC = () => {
  const { profiles, loading, error, refetch } = useLLMProfiles();

  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);

  // Load models dynamically from backend
  useEffect(() => {
    const fetchModels = async () => {
      setLoadingModels(true);
      try {
        const result = await import("../utils/llmProfilesApi").then((m) =>
          m.getAvailableModels()
        );
        const parsed = result?.data
          ? result.data.map((m: any) => m.id)
          : result?.models?.map((m: any) => m.id) || [];
        setAvailableModels(parsed.length ? parsed : ["gpt-4o"]);
      } catch (err) {
        console.error("Failed to load models:", err);
        setAvailableModels(["gpt-4o"]);
      } finally {
        setLoadingModels(false);
      }
    };
    fetchModels();
  }, []);
  const { createProfile, loading: creating } = useCreateLLMProfile();
  const { updateProfile, loading: updating } = useUpdateLLMProfile();
  const { deleteProfile, loading: deleting } = useDeleteLLMProfile();
  const { setDefaultProfile, loading: settingDefault } =
    useSetDefaultLLMProfile();
  const {
    testConnection,
    loading: testingConnection,
    testResult,
  } = useTestLLMConnection();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<
    (Partial<LLMProfileRequest> & { id?: string }) | null
  >(null);
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [connectionTestMessage, setConnectionTestMessage] = useState<
    string | null
  >(null);
  const [connectionTestSuccess, setConnectionTestSuccess] = useState<
    boolean | null
  >(null);

  useEffect(() => {
    if (testResult) {
      setConnectionTestSuccess(testResult.success);
      setConnectionTestMessage(testResult.message || "");
    }
  }, [testResult]);

  const openCreateModal = () => {
    setCurrentProfile({
      name: "",
      server_url: "",
      api_key: "",
      model: "gpt-4o", // Default model
      is_default: false,
    });
    setFormErrors({});
    setConnectionTestMessage(null);
    setConnectionTestSuccess(null);
    setIsModalOpen(true);
  };

  const openEditModal = (profile: LLMProfile) => {
    setCurrentProfile({
      id: profile.id,
      name: profile.name,
      server_url: profile.server_url,
      api_key: "", // API key is never returned, so we don't pre-fill it for security
      model: profile.model || "gpt-4o", // Default to gpt-4o if not set
      is_default: profile.is_default,
    });
    setFormErrors({});
    setConnectionTestMessage(null);
    setConnectionTestSuccess(null);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setCurrentProfile(null);
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setCurrentProfile(
      (prev: (Partial<LLMProfileRequest> & { id?: string }) | null) => ({
        ...prev!,
        [name]: type === "checkbox" ? checked : value,
      })
    );
    setFormErrors((prev) => ({ ...prev, [name]: "" })); // Clear error on change
  };

  const validateForm = () => {
    const errors: { [key: string]: string } = {};
    if (!currentProfile?.name) {
      errors.name = "Profile name is required.";
    }
    if (!currentProfile?.api_key && !currentProfile?.id) {
      // API key is required for new profiles
      errors.api_key = "API key is required.";
    }
    // Basic URL validation
    if (
      currentProfile?.server_url &&
      !/^https?:\/\/.+/.test(currentProfile.server_url)
    ) {
      errors.server_url = "Invalid URL format (e.g., https://api.openai.com).";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      if (currentProfile?.id) {
        // Update existing profile
        await updateProfile(currentProfile.id, {
          name: currentProfile.name,
          server_url: currentProfile.server_url,
          api_key: currentProfile.api_key,
          model: currentProfile.model,
          is_default: currentProfile.is_default,
        });
      } else {
        // Create new profile
        await createProfile({
          name: currentProfile?.name ?? "",
          server_url: currentProfile?.server_url ?? "",
          api_key: currentProfile?.api_key ?? "",
          model: currentProfile?.model ?? "gpt-4o",
          is_default: currentProfile?.is_default ?? false,
        });
      }
      closeModal();
      refetch(); // Refetch profiles after successful operation
    } catch (err) {
      console.error("Failed to save LLM profile:", err);
      setFormErrors({ submit: "Failed to save profile. Please try again." });
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this LLM profile?")) {
      try {
        await deleteProfile(id);
        refetch(); // Refetch profiles after successful operation
      } catch (err) {
        console.error("Failed to delete LLM profile:", err);
        alert("Failed to delete profile. Please try again.");
      }
    }
  };

  const handleSetDefault = async (id: string) => {
    try {
      await setDefaultProfile(id);
      refetch(); // Refetch profiles after successful operation
    } catch (err) {
      console.error("Failed to set default LLM profile:", err);
      alert("Failed to set default profile. Please try again.");
    }
  };

  const handleTestConnection = async () => {
    if (!currentProfile?.api_key) {
      setFormErrors((prev) => ({
        ...prev,
        api_key: "API key is required to test connection.",
      }));
      return;
    }
    try {
      await testConnection(
        currentProfile.server_url || "",
        currentProfile.api_key
      );
    } catch (err) {
      console.error("Connection test failed:", err);
      setConnectionTestSuccess(false);
      setConnectionTestMessage(
        "Connection test failed. Check your server URL and API key."
      );
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
        <p className="mt-2 text-gray-600">Loading AI profiles...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
        <p className="text-sm text-red-700">
          Error loading AI profiles: {error.message}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold text-gray-800">AI Profiles</h2>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none"
        >
          <Plus size={20} className="mr-2" />
          Add New AI Profile
        </button>
      </div>

      {profiles.length === 0 ? (
        <p className="text-gray-600">No AI profiles configured yet.</p>
      ) : (
        <ul className="divide-y divide-gray-200">
          {profiles.map((profile) => (
            <li
              key={profile.id}
              className="py-4 flex items-center justify-between"
            >
              <div>
                <p className="text-lg font-medium text-gray-900 flex items-center">
                  {profile.name}
                  {profile.is_default && (
                    <Star
                      size={18}
                      weight="fill"
                      className="ml-2 text-yellow-500"
                    />
                  )}
                </p>
                <p className="text-sm text-gray-500">
                  {profile.server_url || "Default OpenAI Server"}
                </p>
                <p className="text-xs text-gray-400">
                  Model: {profile.model || "gpt-4o"}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                {!profile.is_default && (
                  <button
                    onClick={() => handleSetDefault(profile.id)}
                    className="text-blue-600 hover:text-blue-900 text-sm"
                    disabled={settingDefault}
                  >
                    {settingDefault ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-blue-600 border-r-transparent"></div>
                    ) : (
                      <Star size={20} />
                    )}
                  </button>
                )}
                <button
                  onClick={() => openEditModal(profile)}
                  className="text-gray-600 hover:text-gray-900"
                >
                  <PencilSimple size={20} />
                </button>
                <button
                  onClick={() => handleDelete(profile.id)}
                  className="text-red-600 hover:text-red-900"
                  disabled={deleting}
                >
                  {deleting ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-red-600 border-r-transparent"></div>
                  ) : (
                    <Trash size={20} />
                  )}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center">
          <div className="bg-white p-8 rounded-lg shadow-xl max-w-md w-full">
            <h3 className="text-2xl font-bold mb-6 text-gray-900">
              {currentProfile?.id ? "Edit AI Profile" : "Add New AI Profile"}
            </h3>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-700"
                >
                  Profile Name
                </label>
                <input
                  type="text"
                  name="name"
                  id="name"
                  value={currentProfile?.name || ""}
                  onChange={handleChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
                {formErrors.name && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
                )}
              </div>
              <div className="mb-4">
                <label
                  htmlFor="server_url"
                  className="block text-sm font-medium text-gray-700"
                >
                  Custom OpenAI Server URL (optional)
                </label>
                <input
                  type="text"
                  name="server_url"
                  id="server_url"
                  value={currentProfile?.server_url || ""}
                  onChange={handleChange}
                  placeholder="e.g., https://api.openai.com"
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Leave empty to use the default OpenAI server.
                </p>
                {formErrors.server_url && (
                  <p className="mt-1 text-sm text-red-600">
                    {formErrors.server_url}
                  </p>
                )}
              </div>
              <div className="mb-4">
                <label
                  htmlFor="model"
                  className="block text-sm font-medium text-gray-700"
                >
                  Model
                </label>
                {loadingModels ? (
                  <div className="mt-2 text-sm text-gray-500">
                    Loading models...
                  </div>
                ) : (
                  <select
                    name="model"
                    id="model"
                    value={currentProfile?.model || "gpt-4o"}
                    onChange={handleChange}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    {availableModels.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  Select the model to use for this profile.
                </p>
              </div>
              <div className="mb-4">
                <label
                  htmlFor="api_key"
                  className="block text-sm font-medium text-gray-700"
                >
                  AI API Key
                </label>
                <input
                  type="password"
                  name="api_key"
                  id="api_key"
                  value={currentProfile?.api_key || ""}
                  onChange={handleChange}
                  className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                />
                {formErrors.api_key && (
                  <p className="mt-1 text-sm text-red-600">
                    {formErrors.api_key}
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testingConnection || !currentProfile?.api_key}
                  className="mt-2 inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                >
                  {testingConnection ? (
                    <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-solid border-gray-600 border-r-transparent"></div>
                  ) : (
                    <CheckCircle size={18} className="mr-2" />
                  )}
                  Test Connection
                </button>
                {connectionTestMessage && (
                  <p
                    className={`mt-2 text-sm flex items-center ${
                      connectionTestSuccess ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {connectionTestSuccess ? (
                      <CheckCircle size={18} className="mr-1" />
                    ) : (
                      <XCircle size={18} className="mr-1" />
                    )}
                    {connectionTestMessage}
                  </p>
                )}
              </div>
              <div className="mb-6 flex items-center">
                <input
                  type="checkbox"
                  name="is_default"
                  id="is_default"
                  checked={currentProfile?.is_default || false}
                  onChange={handleChange}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label
                  htmlFor="is_default"
                  className="ml-2 block text-sm text-gray-900"
                >
                  Set as default AI profile
                </label>
              </div>
              {formErrors.submit && (
                <p className="mt-1 text-sm text-red-600 mb-4">
                  {formErrors.submit}
                </p>
              )}
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating || updating}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none"
                >
                  {(creating || updating) && (
                    <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-solid border-white border-r-transparent"></div>
                  )}
                  {currentProfile?.id ? "Save Changes" : "Add Profile"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AIProfilesSettings;
