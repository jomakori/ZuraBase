import React, { useState } from "react";
import { Robot } from "@phosphor-icons/react";

interface LLMProfileWizardProps {
  onComplete: () => void;
  onSkip: () => void;
}

interface FormState {
  name: string;
  server_url: string;
  api_key: string;
  model: string;
  is_default: boolean;
  service: string;
}

const LLMProfileWizard: React.FC<LLMProfileWizardProps> = ({
  onComplete,
  onSkip,
}) => {
  const [formData, setFormData] = useState<FormState>({
    name: "OpenAI Default",
    server_url: "",
    api_key: "",
    model: "gpt-4o",
    is_default: true,
    service: "openai",
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log("Submitting LLM profile:", formData);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full p-6">
        <div className="text-center mb-4">
          <Robot size={48} className="text-blue-600 mx-auto" />
          <h2 className="text-2xl font-semibold mt-2">
            Set Up Your LLM Profile
          </h2>
          <p className="text-gray-600 text-sm mt-1">
            Configure your preferred LangChain service.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
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
              value={formData.service}
              onChange={handleChange}
              className="w-full border border-gray-300 rounded-md shadow-sm p-2"
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="ollama">Ollama</option>
              <option value="together">Together.ai</option>
              <option value="huggingface">HuggingFace Hub</option>
            </select>
          </div>

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
              value={formData.api_key}
              onChange={handleChange}
              required
              placeholder="Enter your API key"
              className="w-full border border-gray-300 rounded-md shadow-sm p-2"
            />
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
              id="server_url"
              name="server_url"
              value={formData.server_url}
              onChange={handleChange}
              placeholder="https://api.openai.com"
              className="w-full border border-gray-300 rounded-md shadow-sm p-2"
            />
          </div>

          <div>
            <label
              htmlFor="model"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Model
            </label>
            <input
              type="text"
              id="model"
              name="model"
              value={formData.model}
              onChange={handleChange}
              placeholder="e.g., gpt-4o"
              className="w-full border border-gray-300 rounded-md shadow-sm p-2"
            />
          </div>

          <div className="flex justify-between space-x-2">
            <button
              type="submit"
              className="flex-1 bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 transition"
            >
              Save Profile
            </button>
            <button
              type="button"
              onClick={onSkip}
              className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-md hover:bg-gray-50 transition"
            >
              Skip Setup
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default LLMProfileWizard;
