import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import SettingsPage from "./SettingsPage";

// Mock the LLMProfilesSettings component
jest.mock("./LLMProfilesSettings", () => {
  return function MockLLMProfilesSettings() {
    return <div data-testid="llm-profiles-settings">LLM Profiles Settings</div>;
  };
});

describe("SettingsPage", () => {
  const renderWithRouter = (component: React.ReactElement) => {
    return render(<BrowserRouter>{component}</BrowserRouter>);
  };

  it("renders the settings page with tabs", () => {
    renderWithRouter(<SettingsPage />);

    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("General")).toBeInTheDocument();
    expect(screen.getByText("LLM Settings")).toBeInTheDocument();
  });

  it("shows LLM settings by default", () => {
    renderWithRouter(<SettingsPage />);

    expect(screen.getByTestId("llm-profiles-settings")).toBeInTheDocument();
    expect(screen.getByText("LLM Profiles Settings")).toBeInTheDocument();
  });

  it("switches to general settings tab when clicked", () => {
    renderWithRouter(<SettingsPage />);

    // Click on General tab
    fireEvent.click(screen.getByText("General"));

    expect(screen.getByText("General Settings")).toBeInTheDocument();
    expect(
      screen.getByText("No general settings available yet.")
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("llm-profiles-settings")
    ).not.toBeInTheDocument();
  });

  it("switches back to LLM settings tab when clicked", () => {
    renderWithRouter(<SettingsPage />);

    // First switch to General
    fireEvent.click(screen.getByText("General"));
    expect(screen.getByText("General Settings")).toBeInTheDocument();

    // Then switch back to LLM Settings
    fireEvent.click(screen.getByText("LLM Settings"));

    expect(screen.getByTestId("llm-profiles-settings")).toBeInTheDocument();
    expect(screen.queryByText("General Settings")).not.toBeInTheDocument();
  });

  it("highlights the active tab", () => {
    renderWithRouter(<SettingsPage />);

    // LLM Settings should be active by default
    const llmTab = screen.getByText("LLM Settings").closest("button");
    const generalTab = screen.getByText("General").closest("button");

    expect(llmTab).toHaveClass("border-blue-600", "text-blue-600");
    expect(generalTab).not.toHaveClass("border-blue-600", "text-blue-600");

    // Switch to General
    fireEvent.click(screen.getByText("General"));

    expect(llmTab).not.toHaveClass("border-blue-600", "text-blue-600");
    expect(generalTab).toHaveClass("border-blue-600", "text-blue-600");
  });

  it("renders with proper styling", () => {
    renderWithRouter(<SettingsPage />);

    // Check main container styling
    const container = screen.getByText("Settings").closest("div");
    expect(container).toHaveClass(
      "container",
      "mx-auto",
      "px-4",
      "py-8",
      "max-w-4xl"
    );

    // Check tab styling
    const tabsContainer = screen.getByText("General").closest("div");
    expect(tabsContainer).toHaveClass(
      "flex",
      "border-b",
      "border-gray-200",
      "mb-6"
    );
  });
});
