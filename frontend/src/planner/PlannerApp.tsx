import React, { useEffect, useState } from "react";
import { Export, Share, FloppyDisk } from "@phosphor-icons/react";
import NavBar from "../components/NavBar";
import TemplateSelector from "./components/TemplateSelector";
import Board from "./components/Board";
import {
  getTemplates,
  createPlanner,
  getPlanner,
  updatePlanner,
  exportPlannerMarkdown,
} from "./api";
import { PlannerTemplate, Planner } from "./types";
import SharingModal from "../components/SharingModal";

const PlannerApp: React.FC = () => {
  const [templates, setTemplates] = useState<PlannerTemplate[]>([]);
  const [planner, setPlanner] = useState<Planner | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [showSharingModal, setShowSharingModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showBoard, setShowBoard] = useState(false);
  // Get ID from URL query parameter
  const [id, setId] = useState<string | null>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("id");
  });

  // Fetch templates on component mount
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const templates = await getTemplates();
        setTemplates(templates);
      } catch (error) {
        console.error("Failed to fetch templates:", error);
      }
    };

    fetchTemplates();
  }, []);

  // Fetch planner when ID changes
  useEffect(() => {
    const fetchPlanner = async () => {
      if (!id) {
        setIsLoading(false);
        setShowTemplateSelector(true);
        return;
      }

      try {
        const planner = await getPlanner(id);
        setPlanner(planner);
        setShowBoard(false);
      } catch (error) {
        console.error("Failed to fetch planner:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlanner();
  }, [id]);

  const handleCreatePlanner = async (
    templateId: string,
    title: string,
    description: string
  ) => {
    try {
      setIsLoading(true);
      const newPlanner = await createPlanner(templateId, title, description);
      setPlanner(newPlanner);
      // Update URL with the new planner ID
      const url = new URL(window.location.href);
      url.searchParams.set("id", newPlanner.id);
      window.history.pushState(null, "", url.toString());
      setId(newPlanner.id);
      setShowTemplateSelector(false);
      setShowSharingModal(true);
      setShowBoard(false);
    } catch (error) {
      console.error("Failed to create planner:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlannerUpdate = (updatedPlanner: Planner) => {
    setPlanner(updatedPlanner);
    setHasUnsavedChanges(true);
  };

  const handleTitleUpdate = async (
    newTitle: string,
    newDescription: string
  ) => {
    if (!planner) return;

    try {
      const updatedPlanner = await updatePlanner(
        planner.id,
        newTitle,
        newDescription
      );
      setPlanner(updatedPlanner);
      setLastSaved(new Date());
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error("Failed to update planner:", error);
    }
  };

  const handleSave = async () => {
    if (!planner || !hasUnsavedChanges) return;

    setIsSaving(true);
    try {
      // Save the current state of the planner
      const updatedPlanner = await updatePlanner(
        planner.id,
        planner.title,
        planner.description || ""
      );
      setPlanner(updatedPlanner);
      setLastSaved(new Date());
      setHasUnsavedChanges(false);

      // Start auto-save timer
      setTimeout(() => {
        if (hasUnsavedChanges) {
          handleSave();
        }
      }, 2000); // Auto-save after 2 seconds if there are changes
    } catch (error) {
      console.error("Failed to save planner:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleExportMarkdown = async () => {
    if (!planner) return;

    try {
      const markdown = await exportPlannerMarkdown(planner.id);

      // Create a blob and download it
      const blob = new Blob([markdown], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${planner.title.replace(/\s+/g, "-").toLowerCase()}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export markdown:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <NavBar currentPage="planner" />

      {/* Header */}
      <header className="bg-white border-b">
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <div>
              {planner ? (
                <div>
                  <h1 className="text-2xl font-bold text-gray-900">
                    {planner.title}
                  </h1>
                  {planner.description && (
                    <p className="text-sm text-gray-600">
                      {planner.description}
                    </p>
                  )}
                </div>
              ) : (
                <h1 className="text-2xl font-bold text-gray-900">
                  Create New Planner
                </h1>
              )}
            </div>
            {planner && (
              <div className="flex space-x-2">
                <div className="flex items-center space-x-2 rounded bg-gray-200 px-2 py-1 text-sm text-gray-700 cursor-default select-none">
                  <FloppyDisk size={16} />
                  <span>
                    {hasUnsavedChanges
                      ? "Unsaved"
                      : isSaving
                      ? "Saving..."
                      : "Saved"}
                  </span>
                </div>
                <button
                  onClick={handleSave}
                  disabled={isSaving || !hasUnsavedChanges}
                  className={`inline-flex items-center px-3 py-2 border ${
                    hasUnsavedChanges
                      ? "border-transparent text-white bg-blue-600 hover:bg-blue-700"
                      : "border-transparent text-white bg-green-500"
                  } shadow-sm text-sm leading-4 font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
                >
                  <FloppyDisk size={16} className="mr-2" />
                  {isSaving
                    ? "Saving..."
                    : hasUnsavedChanges
                    ? "Save"
                    : "Saved"}
                </button>
                <button
                  onClick={handleExportMarkdown}
                  className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Export size={16} className="mr-2" />
                  Export
                </button>
                <button
                  onClick={() => setShowSharingModal(true)}
                  className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Share size={16} className="mr-2" />
                  Share
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 h-[calc(100vh-64px)]">
        {showTemplateSelector ? (
          <TemplateSelector
            templates={templates}
            onSelect={handleCreatePlanner}
            onCancel={() => (window.location.href = "/")}
          />
        ) : planner && showBoard ? (
          <Board planner={planner} onPlannerUpdate={handlePlannerUpdate} />
        ) : planner && !showBoard ? (
          <div className="text-center py-12 max-w-2xl mx-auto">
            <h2 className="text-2xl font-bold mb-4">{planner.title}</h2>
            {planner.description && (
              <p className="text-gray-600 mb-6">{planner.description}</p>
            )}
            <button
              onClick={() => setShowBoard(true)}
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Open Board
            </button>
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500">
              No planner selected. Create a new one or select an existing one.
            </p>
            <button
              onClick={() => setShowTemplateSelector(true)}
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Create New Planner
            </button>
          </div>
        )}
      </main>

      {/* Sharing Modal */}
      {planner && (
        <SharingModal open={showSharingModal} setOpen={setShowSharingModal} />
      )}
    </div>
  );
};

export default PlannerApp;
