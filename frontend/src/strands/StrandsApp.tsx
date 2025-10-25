import React, { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import StrandsList from "./StrandsList";
import StrandDetail from "./StrandDetail";
import NavBar from "../components/NavBar";
import { Strand } from "./types";
import { useCreateStrand } from "./hooks";

/**
 * Main component for the Strands module
 */
const StrandsApp: React.FC = () => {
  const { user } = useAuth();
  const [selectedStrandId, setSelectedStrandId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const { createStrand, loading: creating } = useCreateStrand();

  // Handle strand selection
  const handleStrandSelect = (strand: Strand) => {
    setSelectedStrandId(strand.id);
    setIsCreating(false);
  };

  // Handle back button click
  const handleBack = () => {
    setSelectedStrandId(null);
    setIsCreating(false);
  };

  // Handle create strand button click
  const handleCreateClick = () => {
    setIsCreating(true);
    setSelectedStrandId(null);
  };

  // Handle strand creation
  const handleCreateStrand = async (content: string, tags: string[] = []) => {
    if (!user) return;

    try {
      const response = await createStrand({
        content,
        source: "manual",
        tags,
      });

      if (response.strand) {
        setSelectedStrandId(response.strand.id);
        setIsCreating(false);
      }
    } catch (error) {
      console.error("Failed to create strand:", error);
    }
  };

  // Render create strand form
  const renderCreateForm = () => {
    const [content, setContent] = useState("");
    const [tags, setTags] = useState<string[]>([]);
    const [newTag, setNewTag] = useState("");

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
      if (content.trim()) {
        handleCreateStrand(content, tags);
      }
    };

    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="flex justify-between items-center mb-6">
          <button
            onClick={handleBack}
            className="inline-flex items-center text-blue-600 hover:text-blue-800"
          >
            <span className="mr-1">←</span>
            Back to Strands
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
          <div className="p-6">
            <h2 className="text-xl font-semibold mb-4">Create New Strand</h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label
                  htmlFor="content"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Content
                </label>
                <textarea
                  id="content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full h-64 p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter your thoughts, insights, or information..."
                  required
                />
              </div>

              <div className="mb-4">
                <label
                  htmlFor="tags"
                  className="block text-sm font-medium text-gray-700 mb-1"
                >
                  Tags
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {tags.map((tag) => (
                    <div
                      key={tag}
                      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                    >
                      #{tag}
                      <button
                        type="button"
                        className="ml-1 flex-shrink-0 inline-flex items-center justify-center h-4 w-4 rounded-full bg-blue-200 hover:bg-blue-300 focus:outline-none"
                        onClick={() => handleRemoveTag(tag)}
                      >
                        <span className="text-xs">×</span>
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex">
                  <input
                    type="text"
                    id="tags"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    className="flex-grow mr-2 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Add a tag..."
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="px-3 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none"
                  >
                    Add
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Tags help organize and find your strands later
                </p>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleBack}
                  className="mr-2 px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none"
                  disabled={creating || !content.trim()}
                >
                  {creating ? "Creating..." : "Create Strand"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar currentPage="strands" />
      <div className="pt-4">
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
      </div>
    </div>
  );
};

export default StrandsApp;
