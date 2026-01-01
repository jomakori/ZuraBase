import React, { useState } from "react";
import { Gear, Robot } from "@phosphor-icons/react";
import AIProfilesSettings from "./LLMProfilesSettings"; // Component renamed but file path remains the same

const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState("ai"); // Default to AI settings

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Settings</h1>

      <div className="flex border-b border-gray-200 mb-6">
        <button
          className={`py-2 px-4 text-sm font-medium ${
            activeTab === "general"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-gray-500 hover:text-gray-700"
          } focus:outline-none flex items-center`}
          onClick={() => setActiveTab("general")}
        >
          <Gear size={20} className="mr-2" />
          General
        </button>
        <button
          className={`py-2 px-4 text-sm font-medium ${
            activeTab === "ai"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-gray-500 hover:text-gray-700"
          } focus:outline-none flex items-center`}
          onClick={() => setActiveTab("ai")}
        >
          <Robot size={20} className="mr-2" />
          AI Settings
        </button>
      </div>

      <div>
        {activeTab === "general" && (
          <div className="bg-white p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              General Settings
            </h2>
            <p className="text-gray-600">No general settings available yet.</p>
          </div>
        )}

        {activeTab === "ai" && <AIProfilesSettings />}
      </div>
    </div>
  );
};

export default SettingsPage;
