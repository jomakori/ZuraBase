import React, { useState, useEffect } from "react";
import { useStrand, useUpdateStrand, useDeleteStrand } from "./hooks";
import TagChip from "./components/TagChip";
import SyncLogViewer from "./components/SyncLogViewer";
import ConfirmDialog from "./components/ConfirmDialog";
import Dialog from "../components/Dialog";
import Toast from "../components/Toast";
import SyncProgressModal from "./components/SyncProgressModal";
import { Strand, SyncLog } from "./types";
import { StrandsApi } from "./api";
import { syncService, SyncProgress } from "./syncService";
import {
  ArrowLeft,
  CalendarBlank,
  Tag,
  Trash,
  PencilSimple,
  Check,
  X,
  ArrowsClockwise,
  ClockCounterClockwise,
} from "@phosphor-icons/react";

interface StrandDetailProps {
  strandId: string;
  onBack: () => void;
  onDeleted?: () => void;
}

/**
 * Component for displaying and editing a single strand
 */
const StrandDetail: React.FC<StrandDetailProps> = ({
  strandId,
  onBack,
  onDeleted,
}) => {
  const { strand, loading, error, refetch } = useStrand(strandId);
  const { updateStrand, loading: updating } = useUpdateStrand();
  const { deleteStrand, loading: deleting } = useDeleteStrand();
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [editedTags, setEditedTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");
  const [activeTab, setActiveTab] = useState<"details" | "logs">("details");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRollbackConfirm, setShowRollbackConfirm] = useState(false);
  const [pendingRollbackLog, setPendingRollbackLog] = useState<SyncLog | null>(
    null
  );

  // Sync state
  const [showSyncProgress, setShowSyncProgress] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({
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

  // Initialize form when strand data is loaded
  useEffect(() => {
    if (strand) {
      setEditedContent(strand.content);
      setEditedTags([...strand.tags]);
    }
  }, [strand]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
    // Reset to original values
    if (strand) {
      setEditedContent(strand.content);
      setEditedTags([...strand.tags]);
    }
  };

  const handleSave = async () => {
    if (!strand) return;

    try {
      await updateStrand(strand.id, {
        content: editedContent,
        tags: editedTags,
      });
      setIsEditing(false);
    } catch (err) {
      console.error("Failed to update strand:", err);
    }
  };

  const handleDelete = async () => {
    if (!strand) return;
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!strand) return;

    setShowDeleteConfirm(false);
    try {
      await deleteStrand(strand.id);
      if (onDeleted) {
        onDeleted();
      } else {
        onBack();
      }
    } catch (err) {
      console.error("Failed to delete strand:", err);
      setToast({
        show: true,
        message: "Failed to delete strand. Please try again.",
        variant: "error",
      });
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setEditedTags(editedTags.filter((tag) => tag !== tagToRemove));
  };

  const handleAddTag = () => {
    if (newTag.trim() && !editedTags.includes(newTag.trim())) {
      setEditedTags([...editedTags, newTag.trim()]);
      setNewTag("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSync = async () => {
    if (!strand) return;

    setShowSyncProgress(true);

    try {
      await syncService.syncSingle(strand, {
        onProgress: (progress) => {
          setSyncProgress(progress);
        },
      });

      // Refetch to get updated data
      setTimeout(() => {
        refetch();
      }, 1000);
    } catch (err) {
      console.error("Failed to sync strand:", err);
    } finally {
      setTimeout(() => {
        setShowSyncProgress(false);
      }, 2000);
    }
  };

  const handleRollback = async (log: SyncLog) => {
    if (!strand) return;
    setPendingRollbackLog(log);
    setShowRollbackConfirm(true);
  };

  const confirmRollback = async () => {
    if (!strand || !pendingRollbackLog) return;

    setShowRollbackConfirm(false);

    try {
      await StrandsApi.rollbackStrand(strand.id, pendingRollbackLog.timestamp);
      setToast({
        show: true,
        message: "Successfully restored to previous version.",
        variant: "success",
      });
      // Refetch the strand to get updated data including new rollback entry
      setTimeout(() => {
        refetch();
      }, 500);
    } catch (err) {
      console.error("Failed to rollback:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Failed to rollback strand";
      setToast({
        show: true,
        message: errorMessage,
        variant: "error",
      });
    } finally {
      setPendingRollbackLog(null);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-8">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-2 text-gray-600">Loading strand...</p>
        </div>
      </div>
    );
  }

  if (error || !strand) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-red-700">
                Error loading strand. Please try again later.
              </p>
              <button
                onClick={onBack}
                className="mt-2 text-sm text-blue-600 hover:text-blue-800"
              >
                Go back
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header with back button */}
      <div className="flex justify-between items-center mb-6">
        <button
          onClick={onBack}
          className="inline-flex items-center text-blue-600 hover:text-blue-800"
        >
          <ArrowLeft size={20} className="mr-1" />
          Back to Strands
        </button>

        <div className="flex items-center space-x-2">
          {/* Sync Button */}
          {!isEditing && (
            <button
              onClick={handleSync}
              className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none transition-colors"
            >
              <ArrowsClockwise size={18} className="mr-1" />
              Sync
            </button>
          )}

          {isEditing ? (
            <>
              <button
                onClick={handleCancel}
                className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                disabled={updating}
              >
                <X size={18} className="mr-1" />
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none"
                disabled={updating}
              >
                {updating ? (
                  <div className="h-4 w-4 mr-1 animate-spin rounded-full border-2 border-solid border-white border-r-transparent"></div>
                ) : (
                  <Check size={18} className="mr-1" />
                )}
                Save
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleEdit}
                className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
              >
                <PencilSimple size={18} className="mr-1" />
                Edit
              </button>
              <button
                onClick={handleDelete}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none"
                disabled={deleting}
              >
                {deleting ? (
                  <div className="h-4 w-4 mr-1 animate-spin rounded-full border-2 border-solid border-white border-r-transparent"></div>
                ) : (
                  <Trash size={18} className="mr-1" />
                )}
                Delete
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("details")}
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === "details"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            Details
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
              activeTab === "logs"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            }`}
          >
            <ClockCounterClockwise size={18} className="mr-1" />
            Sync History
            {strand.sync_history && strand.sync_history.length > 0 && (
              <span className="ml-2 bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full text-xs">
                {strand.sync_history.length}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "details" ? (
        <>
          {/* Metadata */}
          <div className="bg-gray-50 p-4 rounded-lg mb-6 flex flex-wrap gap-4 text-sm text-gray-500">
            <div className="flex items-center">
              <CalendarBlank size={16} className="mr-1" />
              <span>Created: {formatDate(strand.created_at)}</span>
            </div>
            <div className="flex items-center">
              <span className="capitalize">Source: {strand.source}</span>
            </div>
            {strand.synced_with_ai && (
              <div className="flex items-center text-green-600">
                <Check size={16} className="mr-1" />
                <span>Synced with AI</span>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
            <div className="p-6">
              {isEditing ? (
                <textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  className="w-full h-64 p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter strand content..."
                />
              ) : (
                <div className="prose max-w-none">
                  <h2 className="text-xl font-semibold mb-4">
                    {strand.summary || "Strand Content"}
                  </h2>
                  <p className="whitespace-pre-wrap">{strand.content}</p>
                </div>
              )}
            </div>
          </div>

          {/* Tags */}
          <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
            <div className="p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                <Tag size={20} className="mr-2" />
                Tags
              </h3>

              {isEditing ? (
                <div>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {editedTags.map((tag, index) => (
                      <TagChip
                        key={`${tag}-${index}`}
                        tag={tag}
                        removable
                        onRemove={handleRemoveTag}
                      />
                    ))}
                  </div>

                  <div className="flex mt-2">
                    <input
                      type="text"
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="flex-grow mr-2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Add a tag..."
                    />
                    <button
                      onClick={handleAddTag}
                      className="px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none"
                    >
                      Add
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {strand.tags.length > 0 ? (
                    strand.tags.map((tag, index) => (
                      <TagChip key={`${tag}-${index}`} tag={tag} />
                    ))
                  ) : (
                    <p className="text-gray-500 italic">No tags</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Related Strands (placeholder for future implementation) */}
          {strand.related_ids && strand.related_ids.length > 0 && (
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="p-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">
                  Related Strands
                </h3>
                <p className="text-gray-500 italic">
                  Related strands will be displayed here in a future update.
                </p>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Logs Tab */
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-6">
            <SyncLogViewer
              syncHistory={strand.sync_history || []}
              onRollback={handleRollback}
            />
          </div>
        </div>
      )}

      {/* Confirm Dialogs */}
      <Dialog
        isOpen={showDeleteConfirm}
        title="Delete Strand"
        message="Are you sure you want to delete this strand? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
        onConfirm={confirmDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      <Dialog
        isOpen={showRollbackConfirm}
        title="Restore Version"
        message="Are you sure you want to restore this version? This will create a new entry in the sync history."
        confirmText="Restore"
        cancelText="Cancel"
        variant="warning"
        onConfirm={confirmRollback}
        onCancel={() => {
          setShowRollbackConfirm(false);
          setPendingRollbackLog(null);
        }}
      />

      {/* Sync Progress Modal */}
      <SyncProgressModal
        isOpen={showSyncProgress}
        progress={syncProgress}
        onClose={() => setShowSyncProgress(false)}
        canCancel={true}
        onCancel={() => syncService.cancel()}
      />
    </div>
  );
};

export default StrandDetail;
