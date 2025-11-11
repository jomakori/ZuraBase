import React from "react";
import { useLLMConnectionWizard } from "../utils/useLLMConnectionWizard";
import { SearchableModelSelect } from "./SearchableModelSelect";
import { Robot, CheckCircle, XCircle } from "@phosphor-icons/react";

interface LLMProfileWizardProps {
  onComplete?: () => void;
  onSkip?: () => void;
  initialData?: {
    name?: string;
    server_url?: string;
    api_key?: string;
    model?: string;
    is_default?: boolean;
    service?: string;
    id?: string;
  };
  showSkipButton?: boolean;
  autoDefaultFirst?: boolean;
}

const LLMProfileWizard: React.FC<LLMProfileWizardProps> = ({
  onComplete,
  onSkip,
  initialData,
  showSkipButton = false,
  autoDefaultFirst = false,
}) => {
  const [state, actions, loading] = useLLMConnectionWizard({
    initialData,
    onSuccess: onComplete,
  });

  const {
    formData,
    formErrors,
    connectionTested,
    connectionSuccess,
    connectionMessage,
    availableModels,
    loadingModels,
    modelsError,
  } = state;

  const {
    handleChange,
    handleTestConnection,
    handleSubmit,
    setFormData,
    loadModels,
  } = actions;

  // Auto-default first profile if no profiles exist and set default server URL
  React.useEffect(() => {
    if (!formData.id) {
      const updates: any = {};

      // Set as default if this is the first profile
      if (autoDefaultFirst) {
        updates.is_default = true;
      }

      // Set default server URL if not already set
      if (!formData.server_url && formData.service) {
        updates.server_url = getDefaultServerUrl(formData.service);
      } else if (!formData.server_url) {
        // Default to OpenAI if no service specified
        updates.server_url = getDefaultServerUrl("openai");
        updates.service = "openai";
      }

      if (Object.keys(updates).length > 0) {
        setFormData({
          ...formData,
          ...updates,
        });
      }
    }
  }, [autoDefaultFirst, formData.id]);

  const handleServiceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const service = e.target.value;
    setFormData({
      ...formData,
      service,
      // Reset server_url for non-custom services
      server_url: service === "custom" ? "" : getDefaultServerUrl(service),
    });
  };

  const getDefaultServerUrl = (service: string): string => {
    switch (service) {
      case "openai":
        return "https://api.openai.com";
      case "anthropic":
        return "https://api.anthropic.com";
      case "ollama":
        return "http://localhost:11434";
      case "together":
        return "https://api.together.xyz";
      case "huggingface":
        return "https://api-inference.huggingface.co";
      default:
        return "";
    }
  };

  const isCustomService = formData.service === "custom";

  return (
    <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
      <div className="flex items-start justify-between mb-6">
        <Robot size={48} className="text-blue-600 mx-auto" />
        <div className="text-center w-full">
          <h2 className="text-2xl font-semibold mt-2">
            {formData?.id ? "Edit LLM Profile" : "Set Up Your LLM Profile"}
          </h2>
          <p className="text-gray-600 text-sm mt-1">
            Configure your preferred AI service.
          </p>
        </div>
        {/* Close button */}
        <button
          onClick={() => onSkip && onSkip()}
          aria-label="Close wizard"
          className="text-gray-400 hover:text-gray-700 ml-2"
        >
          ✕
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Profile Name */}
        <div>
          <label
            htmlFor="name"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            Profile Name
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formData?.name || ""}
            onChange={handleChange}
            required
            placeholder="e.g., My OpenAI Profile"
            className={`w-full border rounded-md shadow-sm p-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
              formErrors.name ? "border-red-300" : "border-gray-300"
            }`}
          />
          {formErrors.name && (
            <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
          )}
          {!formErrors.name && formData?.name && (
            <p className="mt-1 text-xs text-green-600">
              ✓ Profile name looks good
            </p>
          )}
        </div>

        {/* LLM Service */}
        <div>
          <label
            htmlFor="service"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            LLM Service
          </label>
          <select
            id="service"
            name="service"
            value={formData?.service || "openai"}
            onChange={handleServiceChange}
            className="w-full border border-gray-300 rounded-md shadow-sm p-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="openai">OpenAI</option>
            <option value="anthropic">Anthropic</option>
            <option value="ollama">Ollama</option>
            <option value="together">Together.ai</option>
            <option value="huggingface">HuggingFace Hub</option>
            <option value="custom">Custom (OpenAI-compatible)</option>
          </select>
        </div>

        {/* Custom Server URL - Only show for custom service */}
        {isCustomService && (
          <div>
            <label
              htmlFor="server_url"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Custom Server URL
            </label>
            <input
              type="text"
              id="server_url"
              name="server_url"
              value={formData?.server_url || ""}
              onChange={handleChange}
              required={isCustomService}
              placeholder="https://your-custom-api.com"
              className={`w-full border rounded-md shadow-sm p-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
                formErrors.server_url ? "border-red-300" : "border-gray-300"
              }`}
            />
            {formErrors.server_url && (
              <p className="mt-1 text-sm text-red-600">
                {formErrors.server_url}
              </p>
            )}
            {!formErrors.server_url &&
              formData?.server_url &&
              /^https?:\/\/.+/.test(formData.server_url) && (
                <p className="mt-1 text-xs text-green-600">
                  ✓ Server URL format looks good
                </p>
              )}
            {!formData?.server_url && isCustomService && (
              <p className="mt-1 text-xs text-gray-500">
                Enter the base URL for your custom LLM service (e.g.,
                https://api.openai.com)
              </p>
            )}
          </div>
        )}

        {/* API Key */}
        <div>
          <label
            htmlFor="api_key"
            className="block text-sm font-medium text-gray-700 mb-1"
          >
            API Key
          </label>
          <input
            type="password"
            id="api_key"
            name="api_key"
            value={formData?.api_key || ""}
            onChange={handleChange}
            required
            placeholder="Enter your API key"
            className={`w-full border rounded-md shadow-sm p-2 focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
              formErrors.api_key ? "border-red-300" : "border-gray-300"
            }`}
          />
          {formErrors.api_key && (
            <p className="mt-1 text-sm text-red-600">{formErrors.api_key}</p>
          )}
          {!formErrors.api_key &&
            formData?.api_key &&
            formData.api_key.length >= 10 && (
              <p className="mt-1 text-xs text-green-600">
                ✓ API key format looks good
              </p>
            )}
          {!formData?.api_key && (
            <p className="mt-1 text-xs text-gray-500">
              Your API key is required to connect to the LLM service
            </p>
          )}
        </div>

        {/* Test Connection Button */}
        <div>
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={loading || !formData?.api_key}
            className="w-full inline-flex items-center justify-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-solid border-gray-600 border-r-transparent"></div>
            ) : (
              <CheckCircle size={18} className="mr-2" />
            )}
            Test Connection
          </button>

          {/* Connection Test Result */}
          {connectionTested && connectionMessage && (
            <p
              className={`mt-2 text-sm flex items-center justify-center ${
                connectionSuccess ? "text-green-600" : "text-red-600"
              }`}
            >
              {connectionSuccess ? (
                <CheckCircle size={18} className="mr-1" />
              ) : (
                <XCircle size={18} className="mr-1" />
              )}
              {connectionMessage}
            </p>
          )}
        </div>

        {/* Model Selection - Only show after successful connection test */}
        {connectionSuccess && connectionTested && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="model"
                className="block text-sm font-medium text-gray-700"
              >
                Model{" "}
                {loadingModels && (
                  <span className="text-xs text-gray-500 italic">
                    (Loading...)
                  </span>
                )}
              </label>
            </div>

            {availableModels.length > 0 ? (
              <SearchableModelSelect
                value={formData?.model || ""}
                onChange={(value) => setFormData({ ...formData, model: value })}
                options={availableModels}
                loading={loadingModels}
                disabled={loadingModels}
                placeholder="Select a model"
                className="w-full"
              />
            ) : modelsError ? (
              <p className="mt-1 text-sm text-red-600">{modelsError}</p>
            ) : (
              <p className="mt-1 text-sm text-gray-500 italic">
                Models will load after successful connection test
              </p>
            )}
          </div>
        )}

        {/* Set as Default - Only show for new profiles */}
        {!formData?.id && (
          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_default"
              name="is_default"
              checked={formData?.is_default || false}
              onChange={handleChange}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label
              htmlFor="is_default"
              className="ml-2 block text-sm text-gray-900"
            >
              Set as default LLM profile
            </label>
          </div>
        )}

        {/* Submit Error */}
        {formErrors.submit && (
          <p className="text-sm text-red-600">{formErrors.submit}</p>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between space-x-2">
          {showSkipButton && onSkip && (
            <button
              type="button"
              onClick={onSkip}
              className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-md hover:bg-gray-50 transition focus:outline-none"
            >
              Skip Setup
            </button>
          )}
          <button
            type="submit"
            disabled={
              loading ||
              (!formData?.id && (!connectionTested || !connectionSuccess)) ||
              !formData?.model
            }
            className={`${
              showSkipButton && onSkip ? "flex-1" : "w-full"
            } bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed`}
          >
            {loading && (
              <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-solid border-white border-r-transparent"></div>
            )}
            {formData?.id ? "Save Changes" : "Save Profile"}
          </button>
          {!formData?.model && connectionSuccess && (
            <p className="mt-2 text-xs text-gray-500 text-center">
              Please select a model to continue
            </p>
          )}
        </div>
      </form>
    </div>
  );
};

export default LLMProfileWizard;
