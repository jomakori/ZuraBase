import React, { useState, useEffect } from "react";
import { useLLMProfiles } from "../utils/llmProfilesHooks";
import { getApiBase } from "../getApiBase";

interface ConnectionStatusProps {
  className?: string;
}

/**
 * Component to display AI connection status in the bottom left of the app
 */
const AIConnectionStatus: React.FC<ConnectionStatusProps> = ({
  className = "",
}) => {
  const { profiles, loading: profilesLoading } = useLLMProfiles();
  const [connectionStatus, setConnectionStatus] = useState<
    "connected" | "disconnected" | "checking" | "no-profiles"
  >("checking");
  const [statusMessage, setStatusMessage] = useState<string>("");

  const checkConnection = async () => {
    if (profilesLoading) {
      setConnectionStatus("checking");
      setStatusMessage("Loading profiles...");
      return;
    }

    if (profiles.length === 0) {
      setConnectionStatus("no-profiles");
      setStatusMessage("No AI profiles configured");
      return;
    }

    setConnectionStatus("checking");
    setStatusMessage("Checking AI service availability...");

    try {
      // Check if we have a default LLM profile configured
      const defaultProfile = profiles.find((p) => p.is_default) || profiles[0];

      if (!defaultProfile) {
        setConnectionStatus("no-profiles");
        setStatusMessage("No active AI profile");
        return;
      }

      // Test the actual LLM connection using the stored profile
      const response = await fetch(
        `${getApiBase()}/llm-profiles/${
          defaultProfile.id
        }/test-stored-connection`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setConnectionStatus("connected");
          setStatusMessage(`Connected to ${defaultProfile.name}`);
        } else {
          setConnectionStatus("disconnected");
          setStatusMessage(
            `Connection failed: ${result.message || "Unknown error"}`
          );
        }
      } else {
        setConnectionStatus("disconnected");
        setStatusMessage("Connection test failed");
      }
    } catch (error) {
      setConnectionStatus("disconnected");
      setStatusMessage("Connection test failed");
      console.error("Connection test error:", error);
    }
  };

  useEffect(() => {
    checkConnection();
  }, [profiles, profilesLoading]);

  // Don't show anything if there are no profiles
  if (profiles.length === 0 && !profilesLoading) {
    return null;
  }

  const getStatusColor = () => {
    switch (connectionStatus) {
      case "connected":
        return "text-green-600 bg-green-100 border-green-200";
      case "disconnected":
        return "text-red-600 bg-red-100 border-red-200";
      case "checking":
        return "text-yellow-600 bg-yellow-100 border-yellow-200";
      case "no-profiles":
        return "text-gray-600 bg-gray-100 border-gray-200";
      default:
        return "text-gray-600 bg-gray-100 border-gray-200";
    }
  };

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case "connected":
        return "🟢";
      case "disconnected":
        return "🔴";
      case "checking":
        return "🟡";
      case "no-profiles":
        return "⚪";
      default:
        return "⚪";
    }
  };

  return (
    <div className={`fixed bottom-4 left-4 z-50 ${className}`}>
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium shadow-sm ${getStatusColor()}`}
        title={statusMessage}
      >
        <span className="text-xs">{getStatusIcon()}</span>
        <span className="hidden sm:inline">AI</span>
        <span className="hidden md:inline">
          {connectionStatus === "connected" && "Connected"}
          {connectionStatus === "disconnected" && "Disconnected"}
          {connectionStatus === "checking" && "Checking..."}
          {connectionStatus === "no-profiles" && "No Profiles"}
        </span>
      </div>
    </div>
  );
};

export default AIConnectionStatus;
