import React, { useState, useEffect } from "react";
import { useAuth } from "@/features/auth/context/AuthContext";
import StrandsList from "./StrandsList";
import StrandDetail from "./StrandDetail";
import { Strand } from "@/features/strands/types";
import { useCreateStrand } from "@/features/strands/hooks/strands.hooks";
import { getApiBase } from "@/app/getApiBase";
import { useLLMProfilesContext } from "@/shared/context/LLMProfilesProvider";
import LLMProfileWizard from "@/shared/components/LLMProfileWizard";
import Dialog from "@/shared/components/Dialog";
import Toast from "@/shared/components/Toast";
import SyncProgressModal from "./SyncProgressModal";
import { syncService, SyncProgress } from "@/features/strands/services/syncService";
import ImportIntegrationsSection from "./ImportIntegrationsSection";
import { ArrowsClockwise, CaretDown } from "@phosphor-icons/react";

/**
 * Redesigned Strands App – modern workspace layout
 * Inspired by project dashboards with AI tag synchronization
 */
const StrandsApp: React.FC = () => {
  const { user } = useAuth();
  const { profiles, loading: profilesLoading } = useLLMProfilesContext();
  const [selectedStrandId, setSelectedStrandId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const { createStrand, loading: creating } = useCreateStrand();
  const [showLLMWizard, setShowLLMWizard] = useState(false);
  const [hasSeenWizard, setHasSeenWizard] = useState(false);
  const [showSyncDropdown, setShowSyncDropdown] = useState(false);
  const [syncMode, setSyncMode] = useState<"unsynced" | "all">("unsynced");

  // Sync progress state for bulk sync
  const [showBulkSyncProgress, setShowBulkSyncProgress] = useState(false);
  const [bulkSyncProgress, setBulkSyncProgress] = useState<SyncProgress>({
    total: 0,
    completed: 0,
    failed: 0,
    status: "syncing",
  });

  // Toast notifications
  const [toast, setToast] = useState<{
    show: boolean;
    message: string;
    variant: "success" | "error" | "info" | "warning";
  }>({
    show: false,
    message: "",
    variant: "info",
  });

  // Form state - moved to top level to fix React Hooks order violation
  const [content, setContent] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");

  const handleStrandSelect = (strand: Strand) => {
    setSelectedStrandId(strand.id);
    setIsCreating(false);
  };

  const handleBack = () => {
    setSelectedStrandId(null);
    setIsCreating(false);
    resetForm();
  };

  const resetForm = () => {
    setContent("");
    setTags([]);
    setNewTag("");
  };

  const handleCreateClick = () => {
    setIsCreating(true);
    setSelectedStrandId(null);
  };

  const handleCreateStrand = async (content: string, tags: string[] = []) => {
    if (!user) return;
    try {
      const response = await createStrand({
        content,
        source: "manual",
        tags,
      });
      if (response.strand) {
        // Show feedback about AI processing status
        if (!response.strand.synced_with_ai) {
          // Using a less intrusive notification instead of alert
          console.info(
            "Your strand was saved and will be processed by AI shortly."
          );
        }

        // Store the ID locally before setting state
        const createdId = response.strand.id;
        console.log(`Strand created successfully with ID: ${createdId}`);

        // Reset form first to ensure clean state
        resetForm();
        setIsCreating(false);

        // Set the selected ID after a short delay to ensure the UI has updated
        setTimeout(() => {
          setSelectedStrandId(createdId);
        }, 100);
      }
    } catch (error) {
      console.error("Failed to create strand:", error);
      setToast({
        show: true,
        message: "There was an error saving your strand. Please try again.",
        variant: "error",
      });
    }
  };

  const handleSyncWithAI = async (mode: "unsynced" | "all" = "unsynced") => {
    if (!user) return;

    // Directly initiate sync, progress modal will handle messages
    setSyncMode(mode);
    setShowSyncDropdown(false);
    await initiateBulkSync(mode);
  };

  const initiateBulkSync = async (mode: "unsynced" | "all") => {
    setShowBulkSyncProgress(true);

    try {
      // Fetch all strands to pass to syncMultiple
      const allStrandsResponse = await fetch(`${getApiBase()}/strands`, {
        method: "GET",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!allStrandsResponse.ok) {
        throw new Error("Failed to fetch strands for bulk sync.");
      }
      const allStrandsData = await allStrandsResponse.json();
      const allStrands: Strand[] = allStrandsData.strands || [];

      const strandsToSync =
        syncMode === "unsynced"
          ? allStrands.filter((s) => !s.synced_with_ai)
          : allStrands;

      if (strandsToSync.length === 0) {
        setBulkSyncProgress({
          total: 0,
          completed: 0,
          failed: 0,
          status: "completed",
          message: "No strands found to sync.",
          currentOperation: "No action needed",
        });
        setTimeout(() => setShowBulkSyncProgress(false), 3000);
        return;
      }

      await syncService.syncMultiple(strandsToSync, {
        onProgress: (progress) => {
          setBulkSyncProgress(progress);
        },
        onComplete: (results) => {
          // The SyncProgressModal will show the final message
          setTimeout(() => window.location.reload(), 1500);
        },
        onError: (error) => {
          // Error message is already set in bulkSyncProgress by syncService
          console.error("Bulk sync operation failed:", error);
        },
      });
    } catch (error) {
      console.error("Failed to initiate bulk sync:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";
      setBulkSyncProgress({
        total: 0,
        completed: 0,
        failed: 1,
        status: "error",
        message: `Failed to initiate bulk sync: ${errorMessage}`,
        currentOperation: "Initialization failed",
      });
      setTimeout(() => setShowBulkSyncProgress(false), 3000);
    }
  };

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (content.trim()) handleCreateStrand(content, tags);
  };

  const renderCreateForm = () => {
    return (
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-md p-8">
        <h2 className="text-xl font-semibold mb-4">Create New Strand</h2>
        <form onSubmit={handleSubmit}>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full h-40 border border-gray-300 rounded-md p-3 text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Enter a thought, insight, or pasted content..."
          />

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Tags
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center px-3 py-1 text-sm rounded-full bg-blue-100 text-blue-700"
                >
                  #{tag}
                  <button
                    className="ml-2 text-xs text-red-500 font-bold"
                    onClick={() => handleRemoveTag(tag)}
                    type="button"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder="Add a tag..."
                className="flex-grow border px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={handleAddTag}
                type="button"
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Add
              </button>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={handleBack}
              type="button"
              className="mr-2 px-4 py-2 border rounded-md text-sm text-gray-600 bg-gray-100 hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={creating || !content.trim()}
              className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create Strand"}
            </button>
          </div>
        </form>
      </div>
    );
  };

  // Show LLM wizard if no profiles exist and user hasn't seen it yet
  useEffect(() => {
    if (user && !profilesLoading && profiles.length === 0 && !hasSeenWizard) {
      // Small delay to ensure the main UI loads first
      const timer = setTimeout(() => {
        setShowLLMWizard(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [user, profilesLoading, profiles.length, hasSeenWizard]);

  // Show error page if user is not authenticated
  if (!user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="max-w-md text-center bg-white shadow-md rounded-lg p-8">
          <h1 className="text-2xl font-semibold text-gray-800 mb-4">
            Authentication Required
          </h1>
          <p className="text-gray-600 mb-6">
            Please sign in to access your Strands. This section is available
            only to logged-in users.
          </p>
          <button
            onClick={() => (window.location.href = "/login")}
            className="px-6 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  const handleLLMWizardComplete = () => {
    setShowLLMWizard(false);
    setHasSeenWizard(true);
  };

  const handleLLMWizardSkip = () => {
    setShowLLMWizard(false);
    setHasSeenWizard(true);
  };

  return (
    <div className="min-h-screen w-full bg-gray-50 flex flex-col">
      {showLLMWizard && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center z-50">
          <LLMProfileWizard
            onComplete={handleLLMWizardComplete}
            onSkip={handleLLMWizardSkip}
            showSkipButton={true}
            autoDefaultFirst={true}
          />
        </div>
      )}

      {/* Bulk Sync Progress Modal */}
      <SyncProgressModal
        isOpen={showBulkSyncProgress}
        progress={bulkSyncProgress}
        onClose={() => setShowBulkSyncProgress(false)}
        canCancel={true} // Allow cancellation for bulk sync
        onCancel={() => syncService.cancel()}
      />

      {/* Toast Notifications */}
      <Toast
        isOpen={toast.show}
        message={toast.message}
        variant={toast.variant}
        onClose={() => setToast({ ...toast, show: false })}
      />

      <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 shadow-sm">
        <h1 className="text-xl font-semibold text-gray-800">Strands Library</h1>
        <div className="flex items-center gap-4">
          <input
            type="text"
            placeholder="Search strands..."
            className="w-72 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />

          {/* Sync Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowSyncDropdown(!showSyncDropdown)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700"
            >
              <ArrowsClockwise size={16} />
              Sync All
              <CaretDown size={12} />
            </button>

            {showSyncDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-10">
                <div className="py-1">
                  <button
                    onClick={() => handleSyncWithAI("unsynced")}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Sync Unsynced Only
                  </button>
                  <button
                    onClick={() => handleSyncWithAI("all")}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                  >
                    Sync All Strands
                  </button>
                </div>
              </div>
            )}
          </div>

          <button
            onClick={handleCreateClick}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
          >
            + New Strand
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="w-60 bg-white border-r border-gray-200 p-6">
          <h3 className="text-sm font-semibold uppercase text-gray-500 mb-4">
            Filters
          </h3>
          <nav className="space-y-2">
            {["All", "Text", "Image", "Voice", "AI Generated"].map((f) => (
              <button
                key={f}
                className="w-full text-left px-3 py-2 text-sm rounded-md font-medium text-gray-700 hover:bg-blue-50 hover:text-blue-700 transition"
              >
                {f}
              </button>
            ))}
          </nav>
        </aside>

        <main className="flex-1 overflow-y-auto p-8 space-y-8">
          <section>
            <h2 className="sr-only">Import Integrations</h2>
            <ImportIntegrationsSection
              isLinked={false}
              whatsappName=""
              onLogin={() => {
                setToast({
                  show: true,
                  message: "WhatsApp OAuth integration coming soon!",
                  variant: "info",
                });
              }}
            />
          </section>

          {isCreating ? (
            renderCreateForm()
          ) : selectedStrandId ? (
            <StrandDetail strandId={selectedStrandId} onBack={handleBack} />
          ) : (
            <StrandsList
              onStrandSelect={handleStrandSelect}
              onCreateStrand={handleCreateClick}
            />
          )}
        </main>
      </div>
    </div>
  );
};

export default StrandsApp;
