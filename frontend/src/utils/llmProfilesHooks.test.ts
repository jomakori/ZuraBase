import { renderHook, act, waitFor } from "@testing-library/react";
import {
  useLLMProfiles,
  useCreateLLMProfile,
  useUpdateLLMProfile,
  useDeleteLLMProfile,
  useSetDefaultLLMProfile,
  useTestLLMConnection,
  useDefaultLLMProfile,
} from "./llmProfilesHooks";
import { LLMProfilesApi } from "./llmProfilesApi";

// Mock the API
jest.mock("./llmProfilesApi");

const mockLLMProfilesApi = LLMProfilesApi as jest.Mocked<typeof LLMProfilesApi>;

describe("LLM Profiles Hooks", () => {
  const mockProfiles = [
    {
      id: "1",
      user_id: "user1",
      name: "OpenAI Default",
      server_url: "",
      is_default: true,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    },
    {
      id: "2",
      user_id: "user1",
      name: "Custom Server",
      server_url: "https://api.custom-llm.com",
      is_default: false,
      created_at: "2024-01-02T00:00:00Z",
      updated_at: "2024-01-02T00:00:00Z",
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("useLLMProfiles", () => {
    it("fetches profiles successfully", async () => {
      mockLLMProfilesApi.getProfiles.mockResolvedValue({
        profiles: mockProfiles,
      });

      const { result } = renderHook(() => useLLMProfiles());

      // Initial state
      expect(result.current.loading).toBe(true);
      expect(result.current.profiles).toEqual([]);
      expect(result.current.error).toBeNull();

      // Wait for the fetch to complete
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.profiles).toEqual(mockProfiles);
      expect(result.current.error).toBeNull();
      expect(mockLLMProfilesApi.getProfiles).toHaveBeenCalledTimes(1);
    });

    it("handles fetch error", async () => {
      const error = new Error("Failed to fetch profiles");
      mockLLMProfilesApi.getProfiles.mockRejectedValue(error);

      const { result } = renderHook(() => useLLMProfiles());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.profiles).toEqual([]);
      expect(result.current.error).toEqual(error);
    });

    it("refetches profiles when refetch is called", async () => {
      mockLLMProfilesApi.getProfiles.mockResolvedValue({
        profiles: mockProfiles,
      });

      const { result } = renderHook(() => useLLMProfiles());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Call refetch
      await act(async () => {
        await result.current.refetch();
      });

      expect(mockLLMProfilesApi.getProfiles).toHaveBeenCalledTimes(2);
    });
  });

  describe("useCreateLLMProfile", () => {
    it("creates profile successfully", async () => {
      const newProfile = {
        name: "New Profile",
        server_url: "https://api.new-llm.com",
        api_key: "new-api-key",
        is_default: false,
      };

      const createdProfile = {
        id: "3",
        user_id: "user1",
        ...newProfile,
        created_at: "2024-01-03T00:00:00Z",
        updated_at: "2024-01-03T00:00:00Z",
      };

      mockLLMProfilesApi.createProfile.mockResolvedValue({
        profile: createdProfile,
      });

      const { result } = renderHook(() => useCreateLLMProfile());

      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();

      await act(async () => {
        await result.current.createProfile(newProfile);
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.createdProfile).toEqual(createdProfile);
      expect(result.current.error).toBeNull();
      expect(mockLLMProfilesApi.createProfile).toHaveBeenCalledWith(newProfile);
    });

    it("handles create error", async () => {
      const error = new Error("Failed to create profile");
      mockLLMProfilesApi.createProfile.mockRejectedValue(error);

      const { result } = renderHook(() => useCreateLLMProfile());

      await expect(
        act(async () => {
          await result.current.createProfile({
            name: "Test Profile",
            server_url: "",
            api_key: "test-key",
            is_default: false,
          });
        })
      ).rejects.toThrow(error);

      expect(result.current.error).toEqual(error);
    });
  });

  describe("useUpdateLLMProfile", () => {
    it("updates profile successfully", async () => {
      const updateData = {
        name: "Updated Profile",
        server_url: "https://api.updated.com",
      };

      const updatedProfile = {
        id: "1",
        user_id: "user1",
        name: "Updated Profile",
        server_url: "https://api.updated.com",
        is_default: true,
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-03T00:00:00Z",
      };

      mockLLMProfilesApi.updateProfile.mockResolvedValue({
        profile: updatedProfile,
      });

      const { result } = renderHook(() => useUpdateLLMProfile());

      await act(async () => {
        await result.current.updateProfile("1", updateData);
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.updatedProfile).toEqual(updatedProfile);
      expect(result.current.error).toBeNull();
      expect(mockLLMProfilesApi.updateProfile).toHaveBeenCalledWith(
        "1",
        updateData
      );
    });
  });

  describe("useDeleteLLMProfile", () => {
    it("deletes profile successfully", async () => {
      mockLLMProfilesApi.deleteProfile.mockResolvedValue();

      const { result } = renderHook(() => useDeleteLLMProfile());

      await act(async () => {
        await result.current.deleteProfile("1");
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.success).toBe(true);
      expect(result.current.error).toBeNull();
      expect(mockLLMProfilesApi.deleteProfile).toHaveBeenCalledWith("1");
    });

    it("handles delete error", async () => {
      const error = new Error("Failed to delete profile");
      mockLLMProfilesApi.deleteProfile.mockRejectedValue(error);

      const { result } = renderHook(() => useDeleteLLMProfile());

      await expect(
        act(async () => {
          await result.current.deleteProfile("1");
        })
      ).rejects.toThrow(error);

      expect(result.current.success).toBe(false);
      expect(result.current.error).toEqual(error);
    });
  });

  describe("useSetDefaultLLMProfile", () => {
    it("sets default profile successfully", async () => {
      const updatedProfile = {
        id: "2",
        user_id: "user1",
        name: "Custom Server",
        server_url: "https://api.custom-llm.com",
        is_default: true,
        created_at: "2024-01-02T00:00:00Z",
        updated_at: "2024-01-03T00:00:00Z",
      };

      mockLLMProfilesApi.setDefaultProfile.mockResolvedValue({
        profile: updatedProfile,
      });

      const { result } = renderHook(() => useSetDefaultLLMProfile());

      await act(async () => {
        await result.current.setDefaultProfile("2");
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.updatedProfile).toEqual(updatedProfile);
      expect(result.current.error).toBeNull();
      expect(mockLLMProfilesApi.setDefaultProfile).toHaveBeenCalledWith("2");
    });
  });

  describe("useTestLLMConnection", () => {
    it("tests connection successfully", async () => {
      const testResult = {
        success: true,
        message: "Connection successful",
      };

      mockLLMProfilesApi.testConnection.mockResolvedValue(testResult);

      const { result } = renderHook(() => useTestLLMConnection());

      await act(async () => {
        await result.current.testConnection(
          "https://api.test.com",
          "test-api-key"
        );
      });

      expect(result.current.loading).toBe(false);
      expect(result.current.testResult).toEqual(testResult);
      expect(result.current.error).toBeNull();
      expect(mockLLMProfilesApi.testConnection).toHaveBeenCalledWith({
        server_url: "https://api.test.com",
        api_key: "test-api-key",
      });
    });
  });

  describe("useDefaultLLMProfile", () => {
    it("returns the default profile", async () => {
      mockLLMProfilesApi.getProfiles.mockResolvedValue({
        profiles: mockProfiles,
      });

      const { result } = renderHook(() => useDefaultLLMProfile());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.defaultProfile).toEqual(mockProfiles[0]); // First profile is default
      expect(result.current.error).toBeNull();
    });

    it("returns null when no default profile exists", async () => {
      const profilesWithoutDefault = mockProfiles.map((p) => ({
        ...p,
        is_default: false,
      }));
      mockLLMProfilesApi.getProfiles.mockResolvedValue({
        profiles: profilesWithoutDefault,
      });

      const { result } = renderHook(() => useDefaultLLMProfile());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.defaultProfile).toBeNull();
    });
  });
});
