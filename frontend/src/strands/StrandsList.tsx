import React, { useState, useEffect } from "react";
import { useStrands } from "./hooks";
import StrandCard from "./components/StrandCard";
import TagFilter from "./TagFilter";
import { Strand } from "./types";
import { Plus, MagnifyingGlass } from "@phosphor-icons/react";
import { StrandsApi } from "./api";

interface StrandsListProps {
  onStrandSelect?: (strand: Strand) => void;
  onCreateStrand?: () => void;
  onStrandSync?: (strand: Strand) => void;
}

/**
 * Component for displaying a list of strands with filtering capabilities
 */
const StrandsList: React.FC<StrandsListProps> = ({
  onStrandSelect,
  onCreateStrand,
  onStrandSync,
}) => {
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const { strands, loading, error, count } = useStrands({
    tags: selectedTags,
    page,
    limit: 10,
  });

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [selectedTags, searchQuery]);

  const handleTagSelect = (tag: string) => {
    setSelectedTags(
      (prev) =>
        prev.includes(tag)
          ? prev.filter((t) => t !== tag) // Remove tag if already selected
          : [...prev, tag] // Add tag if not selected
    );
  };

  const handleTagClick = (tag: string) => {
    if (!selectedTags.includes(tag)) {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleCreateClick = () => {
    if (onCreateStrand) {
      onCreateStrand();
    }
  };

  const handleStrandSync = async (strand: Strand) => {
    if (onStrandSync) {
      onStrandSync(strand);
    } else {
      // Fallback: trigger sync by updating the strand
      try {
        // Mark strand as unsynced to trigger AI processing
        await StrandsApi.updateStrand(strand.id, {
          content: strand.content,
          source: strand.source,
          tags: strand.tags,
        });
        // Refresh the list to show updated sync status
        window.location.reload();
      } catch (error) {
        console.error("Failed to sync strand:", error);
        alert("Failed to sync strand with AI. Please try again.");
      }
    }
  };

  // Filter strands by search query (client-side filtering)
  const filteredStrands = searchQuery
    ? strands.filter(
        (strand) =>
          strand.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
          strand.summary.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : strands;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Strands</h1>
        <button
          onClick={handleCreateClick}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <Plus size={20} className="mr-1" />
          New Strand
        </button>
      </div>

      <div className="mb-6">
        <TagFilter onTagSelect={handleTagSelect} selectedTags={selectedTags} />
      </div>

      <div className="mb-6 relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <MagnifyingGlass size={20} className="text-gray-400" />
        </div>
        <input
          type="text"
          className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          placeholder="Search strands..."
          value={searchQuery}
          onChange={handleSearchChange}
        />
      </div>

      {loading ? (
        <div className="text-center py-8">
          <p className="text-gray-500">Fetching strands...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-red-700">
                Error loading strands. Please try again later.
              </p>
            </div>
          </div>
        </div>
      ) : filteredStrands.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <p className="text-gray-500 mb-4">
            No strands yet. Reload to refresh!
          </p>
          {selectedTags.length > 0 && (
            <p className="text-sm text-gray-400">
              Try removing some filters or create a new strand
            </p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredStrands.map((strand) => (
            <div
              key={strand.id}
              onClick={() => onStrandSelect && onStrandSelect(strand)}
              className="cursor-pointer"
            >
              <StrandCard
                strand={strand}
                onTagClick={handleTagClick}
                onSync={handleStrandSync}
              />
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {count > 10 && (
        <div className="mt-8 flex justify-center">
          <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium ${
                page === 1
                  ? "text-gray-300 cursor-not-allowed"
                  : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              Previous
            </button>
            <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
              Page {page}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page * 10 >= count}
              className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium ${
                page * 10 >= count
                  ? "text-gray-300 cursor-not-allowed"
                  : "text-gray-500 hover:bg-gray-50"
              }`}
            >
              Next
            </button>
          </nav>
        </div>
      )}
    </div>
  );
};

export default StrandsList;
