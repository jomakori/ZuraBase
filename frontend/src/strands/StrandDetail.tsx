import React, { useState, useEffect } from "react";
import { useStrand, useUpdateStrand, useDeleteStrand } from "./hooks";
import TagChip from "./components/TagChip";
import { Strand } from "./types";
import {
  ArrowLeft,
  CalendarBlank,
  Tag,
  Trash,
  PencilSimple,
  Check,
  X,
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
  const { strand, loading, error } = useStrand(strandId);
  const { updateStrand, loading: updating } = useUpdateStrand();
  const { deleteStrand, loading: deleting } = useDeleteStrand();
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState("");
  const [editedTags, setEditedTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState("");

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

    if (window.confirm("Are you sure you want to delete this strand?")) {
      try {
        await deleteStrand(strand.id);
        if (onDeleted) {
          onDeleted();
        } else {
          onBack();
        }
      } catch (err) {
        console.error("Failed to delete strand:", err);
      }
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

        <div className="flex space-x-2">
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

      {/* Metadata */}
      <div className="bg-gray-50 p-4 rounded-lg mb-6 flex flex-wrap gap-4 text-sm text-gray-500">
        <div className="flex items-center">
          <CalendarBlank size={16} className="mr-1" />
          <span>Created: {formatDate(strand.created_at)}</span>
        </div>
        <div className="flex items-center">
          <span className="capitalize">Source: {strand.source}</span>
        </div>
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
    </div>
  );
};

export default StrandDetail;
