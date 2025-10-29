import React, { useState } from "react";
import {
  Robot,
  CheckCircle,
  XCircle,
  ArrowRight,
  ArrowLeft,
} from "@phosphor-icons/react";
import {
  useLLMProfiles,
  useCreateLLMProfile,
  useTestLLMConnection,
} from "../../utils/llmProfilesHooks";
import { LLMProfileRequest } from "../../utils/llmProfilesApi";

interface LLMProfileWizardProps {
  onComplete: () => void;
  onSkip: () => void;
}

const LLMProfileWizard: React.FC<LLMProfileWizardProps> = ({
  onComplete,
  onSkip,
}) => {
  const { profiles, loading, refetch } = useLLMProfiles();
  const { createProfile, loading: creating } = useCreateLLMProfile();
  const {
    testConnection,
    loading: testingConnection,
    testResult,
  } = useTestLLMConnection();

  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<LLMProfileRequest>({
    name: "OpenAI Default",
    server_url: "",
    api_key: "",
    is_default: true,
  });
  const [formErrors, setFormErrors] = useState<{ [key: string]: string }>({});
  const [connectionTested, setConnectionTested] = useState(false);

  // If profiles are loading or there are existing profiles, don't show wizard
  if (loading || (profiles && profiles.length > 0)) {
    return null;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setFormErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validateForm = () => {
    const errors: { [key: string]: string } = {};
    if (!formData.name) {
      errors.name = "Profile name is required.";
    }
    if (!formData.api_key) {
      errors.api_key = "API key is required.";
    }
    if (formData.server_url && !/^https?:\/\/.+/.test(formData.server_url)) {
      errors.server_url = "Invalid URL format (e.g., https://api.openai.com).";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleTestConnection = async () => {
    if (!formData.api_key) {
      setFormErrors((prev) => ({
        ...prev,
        api_key: "API key is required to test connection.",
      }));
      return;
    }

    try {
      await testConnection(formData.server_url || "", formData.api_key);
      setConnectionTested(true);
    } catch (err) {
      console.error("Connection test failed:", err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      await createProfile(formData);
      await refetch();
      onComplete();
    } catch (err) {
      console.error("Failed to create LLM profile:", err);
      setFormErrors({ submit: "Failed to create profile. Please try again." });
    }
  };

  const steps = [
    {
      title: "Welcome to Strands AI",
      description:
        "Strands uses AI to automatically analyze and tag your content. Let's set up your LLM provider.",
      icon: <Robot size={48} className="text-blue-600" />,
    },
    {
      title: "Configure LLM Provider",
      description: "Enter your API key and optional custom server URL.",
      icon: <Robot size={48} className="text-blue-600" />,
    },
    {
      title: "Ready to Go!",
      description: "Your LLM profile is configured and ready to use.",
      icon: <CheckCircle size={48} className="text-green-600" />,
    },
  ];

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="text-center">
            <div className="mb-6">{steps[0].icon}</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              {steps[0].title}
            </h3>
            <p className="text-gray-600 mb-8">{steps[0].description}</p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
              <h4 className="font-semibold text-blue-900 mb-2">
                What you'll need:
              </h4>
              <ul className="text-blue-800 text-sm space-y-1">
                <li>
                  • An OpenAI API key or equivalent from your LLM provider
                </li>
                <li>
                  • Optional: Custom server URL if using a different provider
                </li>
              </ul>
            </div>
          </div>
        );

      case 2:
        return (
          <div>
            <div className="mb-6 text-center">{steps[1].icon}</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4 text-center">
              {steps[1].title}
            </h3>
            <p className="text-gray-600 mb-6 text-center">
              {steps[1].description}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Profile Name
                </label>
                <input
                  type="text"
                  name="name"
                  id="name"
                  value={formData.name}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g., OpenAI Default"
                />
                {formErrors.name && (
                  <p className="mt-1 text-sm text-red-600">{formErrors.name}</p>
                )}
              </div>

              <div>
                <label
                  htmlFor="server_url"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Custom Server URL (optional)
                </label>
                <input
                  type="text"
                  name="server_url"
                  id="server_url"
                  value={formData.server_url}
                  onChange={handleChange}
                  placeholder="e.g., https://api.openai.com"
                  className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
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

              <div>
                <label
                  htmlFor="api_key"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  LLM API Key
                </label>
                <input
                  type="password"
                  name="api_key"
                  id="api_key"
                  value={formData.api_key}
                  onChange={handleChange}
                  className="w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter your API key"
                />
                {formErrors.api_key && (
                  <p className="mt-1 text-sm text-red-600">
                    {formErrors.api_key}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleTestConnection}
                  disabled={testingConnection || !formData.api_key}
                  className="mt-2 inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                >
                  {testingConnection ? (
                    <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-solid border-gray-600 border-r-transparent"></div>
                  ) : (
                    <CheckCircle size={18} className="mr-2" />
                  )}
                  Test Connection
                </button>

                {testResult && (
                  <p
                    className={`mt-2 text-sm flex items-center ${
                      testResult.success ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {testResult.success ? (
                      <CheckCircle size={18} className="mr-1" />
                    ) : (
                      <XCircle size={18} className="mr-1" />
                    )}
                    {testResult.message}
                  </p>
                )}
              </div>

              {formErrors.submit && (
                <p className="text-sm text-red-600">{formErrors.submit}</p>
              )}
            </form>
          </div>
        );

      case 3:
        return (
          <div className="text-center">
            <div className="mb-6">{steps[2].icon}</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-4">
              {steps[2].title}
            </h3>
            <p className="text-gray-600 mb-8">{steps[2].description}</p>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <p className="text-green-800 text-sm">
                Your LLM profile "<strong>{formData.name}</strong>" has been
                successfully configured and set as default.
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  const handleNext = () => {
    if (currentStep === 2) {
      // Validate form before proceeding from step 2
      if (!validateForm()) return;
      if (!connectionTested) {
        setFormErrors((prev) => ({
          ...prev,
          submit: "Please test the connection before proceeding.",
        }));
        return;
      }
    }
    setCurrentStep((prev) => prev + 1);
  };

  const handleBack = () => {
    setCurrentStep((prev) => prev - 1);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          {/* Progress indicator */}
          <div className="flex justify-center mb-6">
            {steps.map((_, index) => (
              <div key={index} className="flex items-center">
                <div
                  className={`w-3 h-3 rounded-full ${
                    index + 1 <= currentStep ? "bg-blue-600" : "bg-gray-300"
                  }`}
                />
                {index < steps.length - 1 && (
                  <div
                    className={`w-8 h-0.5 mx-1 ${
                      index + 1 < currentStep ? "bg-blue-600" : "bg-gray-300"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {renderStepContent()}

          <div className="flex justify-between mt-8">
            {currentStep === 1 ? (
              <button
                onClick={onSkip}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none"
              >
                Skip for Later
              </button>
            ) : (
              <button
                onClick={handleBack}
                className="flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none"
              >
                <ArrowLeft size={16} className="mr-2" />
                Back
              </button>
            )}

            {currentStep < steps.length - 1 ? (
              <button
                onClick={handleNext}
                className="flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none"
              >
                Next
                <ArrowRight size={16} className="ml-2" />
              </button>
            ) : (
              <button
                onClick={onComplete}
                className="flex items-center px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none"
              >
                Get Started
                <ArrowRight size={16} className="ml-2" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LLMProfileWizard;
