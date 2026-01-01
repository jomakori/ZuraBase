import React, { useState } from "react";
import {
  useDeleteLLMProfile,
  useSetDefaultLLMProfile,
} from "@/shared/hooks/llmProfilesHooks";
import { useLLMProfilesContext } from "../context/LLMProfilesProvider";
import { LLMProfile } from "../utils/llmProfilesApi";
import LLMProfileWizard from "./LLMProfileWizard";

import { Plus, PencilSimple, Trash, Star } from "@phosphor-icons/react";

const AIProfilesSettings: React.FC = () => {
  const { profiles, loading, error, refetch } = useLLMProfilesContext();
  const { deleteProfile, loading: deleting } = useDeleteLLMProfile();
  const { setDefaultProfile, loading: settingDefault } =
    useSetDefaultLLMProfile();

  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<LLMProfile | null>(null);

  const openCreateWizard = () => {
    setEditingProfile(null);
    setIsWizardOpen(true);
  };

  const openEditWizard = (profile: LLMProfile) => {
    setEditingProfile(profile);
    setIsWizardOpen(true);
  };

  const closeWizard = () => {
    setIsWizardOpen(false);
    setEditingProfile(null);
  };

  const handleWizardComplete = async () => {
    closeWizard();
    await refetch();
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

  // Always render the settings container so actions like "Add New" are
  // available even while profiles are loading. Show a small loading
  // indicator where appropriate instead of hiding the entire UI.

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
          onClick={openCreateWizard}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none"
        >
          <Plus size={20} className="mr-2" />
          Add New AI Profile
        </button>
      </div>

      {/* Loading indicator + empty state */}
      {loading ? (
        <div className="text-center py-8">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-2 text-gray-600">Loading AI profiles...</p>
        </div>
      ) : profiles.length === 0 ? (
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
                <p className="text-xs text-gray-400">Model: {profile.model}</p>
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
                  onClick={() => openEditWizard(profile)}
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

      {isWizardOpen && (
        // Clicking the overlay will close the wizard. The wizard itself
        // will stop propagation so clicks inside don't close it.
        <div
          className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center z-50"
          onClick={closeWizard}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <LLMProfileWizard
              onComplete={handleWizardComplete}
              onSkip={closeWizard}
              initialData={
                editingProfile
                  ? {
                      id: editingProfile.id,
                      name: editingProfile.name,
                      server_url: editingProfile.server_url,
                      api_key: "", // API key is never returned, so we don't pre-fill it for security
                      model: editingProfile.model,
                      is_default: editingProfile.is_default,
                    }
                  : {
                      name: "",
                      server_url: "",
                      api_key: "",
                      model: "",
                      is_default: profiles.length === 0, // Auto-default first profile
                    }
              }
              showSkipButton={false}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default AIProfilesSettings;
