import React, { createContext, useContext } from "react";
import { useLLMProfiles } from "../utils/llmProfilesHooks";
import { LLMProfile } from "../utils/llmProfilesApi";

interface LLMProfilesContextType {
  profiles: LLMProfile[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

const LLMProfilesContext = createContext<LLMProfilesContextType | null>(null);

export const LLMProfilesProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const profilesState = useLLMProfiles();
  return (
    <LLMProfilesContext.Provider value={profilesState}>
      {children}
    </LLMProfilesContext.Provider>
  );
};

export const useLLMProfilesContext = () => {
  const context = useContext(LLMProfilesContext);
  if (!context) {
    throw new Error(
      "useLLMProfilesContext must be used within an LLMProfilesProvider"
    );
  }
  return context;
};
