import React, { useEffect, useState, useRef, useCallback } from "react";
import { Share, FloppyDisk } from "@phosphor-icons/react";
import NavBar from "../components/NavBar";
import Board from "./components/Board";
import PlannerWizard from "./components/PlannerWizard";
import {
  getTemplates,
  createPlanner,
  getPlanner,
  updatePlanner,
  exportPlannerMarkdown,
  addLane,
  splitLane,
} from "./api";
import { PlannerTemplate, Planner, PlannerLane } from "./types";
import SharingModal from "../components/SharingModal";
import { useSaveHandler } from "../utils/saveUtils";

const PlannerApp: React.FC = () => {
  const [templates, setTemplates] = useState<PlannerTemplate[]>([]);
  const [planner, setPlanner] = useState<Planner | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPlannerWizard, setShowPlannerWizard] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Track the save state for UI display
  const [saveState, setSaveState] = useState<"unsaved" | "saving" | "saved">(
    "saved"
  );

  // Get ID from URL query parameter
  const initialId = (() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("id");
  })();

  // Use the modular save handler
  const savePlannerWrapper = async (id: string | null, data: any) => {
    if (!id) {
      return null;
    }
    return updatePlanner(id, data.title, data.description || "");
  };

  const {
    queryParamID,
    isSaving,
    lastSaved,
    showSharingModal,
    setShowSharingModal,
    saveDocument,
  } = useSaveHandler(initialId, savePlannerWrapper, planner, hasUnsavedChanges);

  // Fetch templates on component mount
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const templates = await getTemplates();
        setTemplates(templates);
      } catch (error) {
        console.error("Failed to fetch templates:", error);
        setError("Failed to fetch templates. Please try again later.");
      }
    };

    fetchTemplates();
  }, []);

  // Fetch planner when ID changes
  useEffect(() => {
    const fetchPlanner = async () => {
      if (!queryParamID) {
        setIsLoading(false);
        setShowPlannerWizard(true);
        return;
      }

      try {
        const planner = await getPlanner(queryParamID);
        if (planner) {
          console.log("[PLANNER] Fetched planner:", planner);
          setPlanner(planner);
          setError(null);
        } else {
          setError("Failed to load planner. Please try again.");
        }
      } catch (error) {
        console.error("Failed to fetch planner:", error);
        setError("Failed to load planner. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchPlanner();
  }, [queryParamID]);

  const handleSplitLane = async (
    laneId: string,
    newTitle: string,
    newDescription: string,
    splitPosition: number,
    newColor: string
  ) => {
    if (!planner) return;
    try {
      const newLane = await splitLane(
        planner.id,
        laneId,
        newTitle,
        newDescription,
        splitPosition,
        newColor
      );
      const updatedLanes = [...planner.lanes];
      updatedLanes.splice(splitPosition + 1, 0, newLane);
      handlePlannerUpdate({ ...planner, lanes: updatedLanes });
    } catch (error) {
      console.error("Error splitting lane:", error);
      setError("Failed to split lane.");
    }
  };

  // Helper function to create predefined lanes based on template type
  const createPredefinedLanes = async (planner: Planner) => {
    const template = templates.find((t) => t.id === planner.template_id);
    if (!template) return;

    // Create predefined lanes based on template type
    let lanes: PlannerLane[] = [];
    const colors = ["red", "blue", "green", "purple", "orange"]; // Define a set of colors
    let colorIndex = 0;

    const getNextColor = () => {
      const color = colors[colorIndex % colors.length];
      colorIndex++;
      return color;
    };

    // For temporary planners, we'll create the lanes directly in memory
    // This avoids making API calls that will fail for temporary planners
    if (planner.id.toString().startsWith("temp-")) {
      console.log("[PLANNER] Creating in-memory lanes for temporary planner");

      if (template.type === "kanban") {
        // Create Kanban lanes: To Do, In Progress, Done
        lanes = [
          {
            id: `temp-lane-${Date.now()}-1`,
            planner_id: planner.id,
            title: "To Do",
            description: "Tasks that need to be done",
            position: 0,
            color: getNextColor(),
            cards: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            id: `temp-lane-${Date.now()}-2`,
            planner_id: planner.id,
            title: "In Progress",
            description: "Tasks currently being worked on",
            position: 1,
            color: getNextColor(),
            cards: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            id: `temp-lane-${Date.now()}-3`,
            planner_id: planner.id,
            title: "Done",
            description: "Completed tasks",
            position: 2,
            color: getNextColor(),
            cards: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ];
      } else if (template.type === "scrum") {
        // Create Scrum lanes: Backlog, Sprint, In Progress, Testing, Done
        lanes = [
          {
            id: `temp-lane-${Date.now()}-1`,
            planner_id: planner.id,
            title: "Backlog",
            description: "Future tasks and features",
            position: 0,
            color: getNextColor(),
            cards: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            id: `temp-lane-${Date.now()}-2`,
            planner_id: planner.id,
            title: "Sprint",
            description: "Tasks for current sprint",
            position: 1,
            color: getNextColor(),
            cards: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            id: `temp-lane-${Date.now()}-3`,
            planner_id: planner.id,
            title: "In Progress",
            description: "Tasks currently being worked on",
            position: 2,
            color: getNextColor(),
            cards: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            id: `temp-lane-${Date.now()}-4`,
            planner_id: planner.id,
            title: "Testing",
            description: "Tasks being tested",
            position: 3,
            color: getNextColor(),
            cards: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            id: `temp-lane-${Date.now()}-5`,
            planner_id: planner.id,
            title: "Done",
            description: "Completed tasks",
            position: 4,
            color: getNextColor(),
            cards: [],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ];
      }
    } else {
      // For real planners, use the API to create lanes
      if (template.type === "kanban") {
        // Create Kanban lanes: To Do, In Progress, Done
        try {
          const todoLane = await addLane(
            planner.id,
            "To Do",
            "Tasks that need to be done",
            0,
            getNextColor()
          );
          const inProgressLane = await addLane(
            planner.id,
            "In Progress",
            "Tasks currently being worked on",
            1,
            getNextColor()
          );
          const doneLane = await addLane(
            planner.id,
            "Done",
            "Completed tasks",
            2,
            getNextColor()
          );

          lanes = [todoLane, inProgressLane, doneLane];
        } catch (error) {
          console.error("Failed to create predefined Kanban lanes:", error);
        }
      } else if (template.type === "scrum") {
        // Create Scrum lanes: Backlog, Sprint, In Progress, Testing, Done
        try {
          const backlogLane = await addLane(
            planner.id,
            "Backlog",
            "Future tasks and features",
            0,
            getNextColor()
          );
          const sprintLane = await addLane(
            planner.id,
            "Sprint",
            "Tasks for current sprint",
            1,
            getNextColor()
          );
          const inProgressLane = await addLane(
            planner.id,
            "In Progress",
            "Tasks currently being worked on",
            2,
            getNextColor()
          );
          const testingLane = await addLane(
            planner.id,
            "Testing",
            "Tasks being tested",
            3,
            getNextColor()
          );
          const doneLane = await addLane(
            planner.id,
            "Done",
            "Completed tasks",
            4,
            getNextColor()
          );

          lanes = [
            backlogLane,
            sprintLane,
            inProgressLane,
            testingLane,
            doneLane,
          ];
        } catch (error) {
          console.error("Failed to create predefined Scrum lanes:", error);
        }
      }
    }

    // Update the planner with the new lanes
    if (lanes.length > 0) {
      handlePlannerUpdate({
        ...planner,
        lanes: lanes,
      });
    }
  };

  const handleCreatePlanner = async (
    templateId: string,
    title: string,
    description: string
  ) => {
    setError(null);
    try {
      setIsLoading(true);

      // Create a mock planner to display while waiting for the real one
      // Use a combination of timestamp and random string to ensure uniqueness
      const uniqueId = `temp-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 10)}`;
      const mockPlanner: Planner = {
        id: uniqueId,
        title: title,
        description: description,
        template_id: templateId,
        lanes: [],
        columns: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Set the mock planner immediately to improve UX
      setPlanner(mockPlanner);
      setShowPlannerWizard(false);

      // Create predefined lanes for the mock planner
      await createPredefinedLanes(mockPlanner);

      // Try to create the real planner
      try {
        // Attempt to create the planner, but handle the case where the backend fails
        let newPlanner: Planner | null = null;

        try {
          newPlanner = await createPlanner(templateId, title, description);
        } catch (apiError) {
          console.error("API error creating planner:", apiError);
          // Continue with the mock planner if the API fails
          setError(
            "Backend error creating planner. Using temporary planner instead."
          );
          return; // Exit early but keep the mock planner visible
        }

        // If we got a valid planner from the API, use it
        if (newPlanner && newPlanner.id) {
          console.log("[PLANNER] Created planner successfully:", newPlanner);
          setPlanner(newPlanner);

          // Update URL with the new planner ID
          const url = new URL(window.location.href);
          url.searchParams.set("id", newPlanner.id);
          window.history.pushState(null, "", url.toString());

          // Create predefined lanes for the new planner
          await createPredefinedLanes(newPlanner);

          // Show sharing modal
          setShowSharingModal(true);
          setError(null);
        } else {
          // Keep using the mock planner if the API failed or returned invalid data
          console.log("[PLANNER] Using mock planner due to API issues");
          setError(
            "Created planner but received invalid response. Using temporary planner instead."
          );
        }
      } catch (error) {
        console.error("Failed to create planner:", error);
        setError("Failed to create planner. Using temporary planner instead.");
        // Keep the mock planner visible so user can see their work
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-save when planner changes
  const lastChangeTimeRef = useRef<number>(0);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const previousPlannerRef = useRef<Planner | null>(null);

  // Function to schedule auto-save
  const scheduleAutoSave = useCallback(() => {
    // Clear any existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    // Only schedule auto-save if we have an ID (not first save)
    if (queryParamID && hasUnsavedChanges) {
      // Set a timer for auto-save
      autoSaveTimerRef.current = setTimeout(() => {
        console.log("[PLANNER] Auto-saving due to planner change");
        saveDocument();
        autoSaveTimerRef.current = null;
      }, 2000); // Auto-save after 2 seconds of no changes
    }
  }, [queryParamID, hasUnsavedChanges, saveDocument]);

  // Track planner changes
  useEffect(() => {
    if (!planner || !queryParamID) return;

    // Only set unsaved changes if the planner has actually changed
    if (
      previousPlannerRef.current &&
      JSON.stringify(previousPlannerRef.current) !== JSON.stringify(planner)
    ) {
      // Set unsaved changes flag
      setHasUnsavedChanges(true);
      setSaveState("unsaved");

      // Record the time of this change
      lastChangeTimeRef.current = Date.now();

      // Schedule auto-save
      scheduleAutoSave();
    }

    // Update the previous planner ref
    previousPlannerRef.current = JSON.parse(JSON.stringify(planner));

    // Clean up function
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [planner, queryParamID, scheduleAutoSave]);

  const handlePlannerUpdate = (updatedPlanner: Planner) => {
    setPlanner(updatedPlanner);
    setHasUnsavedChanges(true);
    setSaveState("unsaved");
  };

  const handleSave = async () => {
    if (!planner || !hasUnsavedChanges) return;

    try {
      setSaveState("saving");
      await saveDocument(true);
      setHasUnsavedChanges(false);
      setSaveState("saved");
    } catch (error) {
      console.error("Failed to save planner:", error);
      setError("Failed to save planner. Please try again.");
      setSaveState("unsaved");
    }
  };

  // Update save state when relevant states change
  useEffect(() => {
    if (isSaving) {
      setSaveState("saving");
    } else if (hasUnsavedChanges) {
      setSaveState("unsaved");
    } else if (lastSaved) {
      setSaveState("saved");

      // Show a brief visual confirmation that save was successful
      const saveConfirmation = document.querySelector(".planner-save-button");
      if (saveConfirmation) {
        saveConfirmation.classList.add("save-success-flash");
        setTimeout(() => {
          saveConfirmation.classList.remove("save-success-flash");
        }, 1000);
      }
    }
  }, [isSaving, hasUnsavedChanges, lastSaved]);

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
      setError("Failed to export markdown. Please try again.");
    }
  };

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
                <button
                  onClick={handleSave}
                  disabled={saveState === "saving" || saveState === "saved"}
                  className={`planner-save-button inline-flex items-center px-3 py-2 border ${
                    saveState === "unsaved"
                      ? "border-transparent text-white bg-blue-600 hover:bg-blue-700 cursor-pointer"
                      : saveState === "saving"
                      ? "border-transparent text-white bg-yellow-500 cursor-wait"
                      : "border-transparent text-white bg-green-500 cursor-default opacity-75"
                  } shadow-sm text-sm leading-4 font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-300`}
                >
                  <FloppyDisk size={16} className="mr-2" />
                  {saveState === "saving"
                    ? "Saving..."
                    : saveState === "unsaved"
                    ? "Save"
                    : "Saved"}
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

      {/* Error Message */}
      {error && (
        <div className="mx-auto max-w-7xl px-4 py-2 sm:px-6 lg:px-8">
          <div className="bg-red-50 border border-red-200 rounded p-4 mb-4">
            <p className="text-red-800 font-medium">{error}</p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 h-[calc(100vh-64px)]">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : planner ? (
          <div className="h-full">
            {/* Display a message if we're using a temporary planner */}
            {planner.id.toString().startsWith("temp-") && (
              <div className="bg-yellow-50 border border-yellow-200 rounded p-4 mb-4">
                <p className="text-yellow-800 font-medium">
                  Using temporary planner due to backend issues. Your changes
                  will not be saved permanently.
                </p>
              </div>
            )}
            <Board
              planner={planner}
              onPlannerUpdate={handlePlannerUpdate}
              onSplitLane={handleSplitLane}
            />
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-gray-500">
              No planner selected. Create a new one or select an existing one.
            </p>
            <button
              onClick={() => setShowPlannerWizard(true)}
              className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Create New Planner
            </button>
          </div>
        )}

        {/* Planner Creation Wizard */}
        <PlannerWizard
          open={showPlannerWizard}
          setOpen={setShowPlannerWizard}
          templates={templates}
          onCreatePlanner={handleCreatePlanner}
          onCancel={() => (window.location.href = "/")}
        />
      </main>

      {/* Sharing Modal */}
      {planner && (
        <SharingModal open={showSharingModal} setOpen={setShowSharingModal} />
      )}
    </div>
  );
};

export default PlannerApp;
