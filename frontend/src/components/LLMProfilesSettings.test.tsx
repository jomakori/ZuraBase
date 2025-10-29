import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import LLMProfilesSettings from "./LLMProfilesSettings";
import {
  useLLMProfiles,
  useCreateLLMProfile,
  useUpdateLLMProfile,
  useDeleteLLMProfile,
  useSetDefaultLLMProfile,
  useTestLLMConnection,
} from "../utils/llmProfilesHooks";

// Mock the hooks
jest.mock("../utils/llmProfilesHooks");

const mockUseLLMProfiles = useLLMProfiles as jest.MockedFunction<
  typeof useLLMProfiles
>;
const mockUseCreateLLMProfile = useCreateLLMProfile as jest.MockedFunction<
  typeof useCreateLLMProfile
>;
const mockUseUpdateLLMProfile = useUpdateLLMProfile as jest.MockedFunction<
  typeof useUpdateLLMProfile
>;
const mockUseDeleteLLMProfile = useDeleteLLMProfile as jest.MockedFunction<
  typeof useDeleteLLMProfile
>;
const mockUseSetDefaultLLMProfile =
  useSetDefaultLLMProfile as jest.MockedFunction<
    typeof useSetDefaultLLMProfile
  >;
const mockUseTestLLMConnection = useTestLLMConnection as jest.MockedFunction<
  typeof useTestLLMConnection
>;

describe("LLMProfilesSettings", () => {
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

  const mockRefetch = jest.fn();
  const mockCreateProfile = jest.fn();
  const mockUpdateProfile = jest.fn();
  const mockDeleteProfile = jest.fn();
  const mockSetDefaultProfile = jest.fn();
  const mockTestConnection = jest.fn();

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup default mock implementations
    mockUseLLMProfiles.mockReturnValue({
      profiles: mockProfiles,
      loading: false,
      error: null,
      refetch: mockRefetch,
    });

    mockUseCreateLLMProfile.mockReturnValue({
      createProfile: mockCreateProfile,
      loading: false,
      error: null,
      createdProfile: null,
    });

    mockUseUpdateLLMProfile.mockReturnValue({
      updateProfile: mockUpdateProfile,
      loading: false,
      error: null,
      updatedProfile: null,
    });

    mockUseDeleteLLMProfile.mockReturnValue({
      deleteProfile: mockDeleteProfile,
      loading: false,
      error: null,
      success: false,
    });

    mockUseSetDefaultLLMProfile.mockReturnValue({
      setDefaultProfile: mockSetDefaultProfile,
      loading: false,
      error: null,
      updatedProfile: null,
    });

    mockUseTestLLMConnection.mockReturnValue({
      testConnection: mockTestConnection,
      loading: false,
      error: null,
      testResult: null,
    });
  });

  it("renders the component with profiles", () => {
    render(<LLMProfilesSettings />);

    expect(screen.getByText("LLM Profiles")).toBeInTheDocument();
    expect(screen.getByText("Add New Profile")).toBeInTheDocument();
    expect(screen.getByText("OpenAI Default")).toBeInTheDocument();
    expect(screen.getByText("Custom Server")).toBeInTheDocument();
    expect(screen.getByText("Default OpenAI Server")).toBeInTheDocument();
    expect(screen.getByText("https://api.custom-llm.com")).toBeInTheDocument();
  });

  it("shows loading state", () => {
    mockUseLLMProfiles.mockReturnValue({
      profiles: [],
      loading: true,
      error: null,
      refetch: mockRefetch,
    });

    render(<LLMProfilesSettings />);

    expect(screen.getByText("Loading LLM profiles...")).toBeInTheDocument();
  });

  it("shows error state", () => {
    mockUseLLMProfiles.mockReturnValue({
      profiles: [],
      loading: false,
      error: new Error("Failed to load profiles"),
      refetch: mockRefetch,
    });

    render(<LLMProfilesSettings />);

    expect(
      screen.getByText("Error loading LLM profiles: Failed to load profiles")
    ).toBeInTheDocument();
  });

  it("shows empty state when no profiles", () => {
    mockUseLLMProfiles.mockReturnValue({
      profiles: [],
      loading: false,
      error: null,
      refetch: mockRefetch,
    });

    render(<LLMProfilesSettings />);

    expect(
      screen.getByText("No LLM profiles configured yet.")
    ).toBeInTheDocument();
  });

  it("opens create modal when Add New Profile is clicked", () => {
    render(<LLMProfilesSettings />);

    fireEvent.click(screen.getByText("Add New Profile"));

    expect(screen.getByText("Add New LLM Profile")).toBeInTheDocument();
    expect(screen.getByLabelText("Profile Name")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Custom OpenAI Server URL (optional)")
    ).toBeInTheDocument();
    expect(screen.getByLabelText("LLM API Key")).toBeInTheDocument();
  });

  it("opens edit modal when edit button is clicked", () => {
    render(<LLMProfilesSettings />);

    // Find and click the edit button for the first profile
    const editButtons = screen.getAllByRole("button", { name: /edit/i });
    fireEvent.click(editButtons[0]);

    expect(screen.getByText("Edit LLM Profile")).toBeInTheDocument();
    expect(screen.getByDisplayValue("OpenAI Default")).toBeInTheDocument();
  });

  it("validates form inputs", async () => {
    render(<LLMProfilesSettings />);

    // Open create modal
    fireEvent.click(screen.getByText("Add New Profile"));

    // Try to submit without filling required fields
    fireEvent.click(screen.getByText("Add Profile"));

    await waitFor(() => {
      expect(screen.getByText("Profile name is required.")).toBeInTheDocument();
      expect(screen.getByText("API key is required.")).toBeInTheDocument();
    });

    // Fill only name
    fireEvent.change(screen.getByLabelText("Profile Name"), {
      target: { value: "Test Profile" },
    });

    // Try to submit again
    fireEvent.click(screen.getByText("Add Profile"));

    await waitFor(() => {
      expect(screen.getByText("API key is required.")).toBeInTheDocument();
    });
  });

  it("calls createProfile when form is submitted with valid data", async () => {
    mockCreateProfile.mockResolvedValue({});

    render(<LLMProfilesSettings />);

    // Open create modal
    fireEvent.click(screen.getByText("Add New Profile"));

    // Fill form
    fireEvent.change(screen.getByLabelText("Profile Name"), {
      target: { value: "Test Profile" },
    });
    fireEvent.change(screen.getByLabelText("LLM API Key"), {
      target: { value: "test-api-key" },
    });

    // Submit form
    fireEvent.click(screen.getByText("Add Profile"));

    await waitFor(() => {
      expect(mockCreateProfile).toHaveBeenCalledWith({
        name: "Test Profile",
        server_url: "",
        api_key: "test-api-key",
        is_default: false,
      });
      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  it("calls deleteProfile when delete button is clicked", async () => {
    // Mock window.confirm
    window.confirm = jest.fn().mockReturnValue(true);
    mockDeleteProfile.mockResolvedValue({});

    render(<LLMProfilesSettings />);

    // Find and click the delete button for the first profile
    const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(mockDeleteProfile).toHaveBeenCalledWith("1");
      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  it("calls setDefaultProfile when set default button is clicked", async () => {
    mockSetDefaultProfile.mockResolvedValue({});

    render(<LLMProfilesSettings />);

    // Find and click the set default button for the second profile
    const setDefaultButtons = screen.getAllByRole("button", {
      name: /set default/i,
    });
    fireEvent.click(setDefaultButtons[0]);

    await waitFor(() => {
      expect(mockSetDefaultProfile).toHaveBeenCalledWith("2");
      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  it("calls testConnection when test connection button is clicked", async () => {
    mockTestConnection.mockResolvedValue({
      success: true,
      message: "Connection successful",
    });

    render(<LLMProfilesSettings />);

    // Open create modal
    fireEvent.click(screen.getByText("Add New Profile"));

    // Fill API key
    fireEvent.change(screen.getByLabelText("LLM API Key"), {
      target: { value: "test-api-key" },
    });

    // Click test connection
    fireEvent.click(screen.getByText("Test Connection"));

    await waitFor(() => {
      expect(mockTestConnection).toHaveBeenCalledWith("", "test-api-key");
    });
  });

  it("shows connection test result", async () => {
    mockUseTestLLMConnection.mockReturnValue({
      testConnection: mockTestConnection,
      loading: false,
      error: null,
      testResult: {
        success: true,
        message: "Connection successful - 50 models available",
      },
    });

    render(<LLMProfilesSettings />);

    // Open create modal
    fireEvent.click(screen.getByText("Add New Profile"));

    await waitFor(() => {
      expect(
        screen.getByText("Connection successful - 50 models available")
      ).toBeInTheDocument();
    });
  });

  it("handles form cancellation", () => {
    render(<LLMProfilesSettings />);

    // Open create modal
    fireEvent.click(screen.getByText("Add New Profile"));

    // Click cancel
    fireEvent.click(screen.getByText("Cancel"));

    expect(screen.queryByText("Add New LLM Profile")).not.toBeInTheDocument();
  });
});
