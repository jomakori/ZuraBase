import React, { useState, useEffect, useRef } from "react";
import { useStrands } from "../hooks";
import { Strand } from "../types";
import { MagnifyingGlass, X } from "@phosphor-icons/react";

interface StrandEmbedProps {
  onSelect: (strand: Strand) => void;
  onClose: () => void;
}

/**
 * Component for searching and embedding strands in notes
 */
const StrandEmbed: React.FC<StrandEmbedProps> = ({ onSelect, onClose }) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const { strands, loading } = useStrands({ tags: selectedTags });
  const [filteredStrands, setFilteredStrands] = useState<Strand[]>([]);
  const modalRef = useRef<HTMLDivElement>(null);

  // Filter strands based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredStrands(strands);
      return;
    }

    const filtered = strands.filter(
      (strand) =>
        strand.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        strand.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        strand.tags.some((tag) =>
          tag.toLowerCase().includes(searchQuery.toLowerCase())
        )
    );
    setFilteredStrands(filtered);
  }, [searchQuery, strands]);

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        modalRef.current &&
        !modalRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  // Handle tag selection
  const handleTagClick = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  // Handle strand selection
  const handleStrandSelect = (strand: Strand) => {
    onSelect(strand);
    onClose();
  };

  // Truncate content for preview
  const truncateContent = (content: string, maxLength = 100) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + "...";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div
        ref={modalRef}
        className="w-full max-w-2xl rounded-lg bg-white p-6 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Embed a Strand</h2>
          <button
            onClick={onClose}
            className="rounded-full p-1 hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        </div>

        <div className="mb-4 relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <MagnifyingGlass size={20} className="text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder="Search strands..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {selectedTags.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {selectedTags.map((tag) => (
              <div
                key={tag}
                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
              >
                #{tag}
                <button
                  type="button"
                  className="ml-1 flex-shrink-0 inline-flex items-center justify-center h-4 w-4 rounded-full bg-blue-200 hover:bg-blue-300 focus:outline-none"
                  onClick={() => handleTagClick(tag)}
                >
                  <span className="text-xs">×</span>
                </button>
              </div>
            ))}
            <button
              className="text-xs text-blue-600 hover:text-blue-800"
              onClick={() => setSelectedTags([])}
            >
              Clear all
            </button>
          </div>
        )}

        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-blue-600 border-r-transparent"></div>
            </div>
          ) : filteredStrands.length === 0 ? (
            <div className="py-8 text-center text-gray-500">
              No strands found. Try a different search.
            </div>
          ) : (
            <div className="space-y-3">
              {filteredStrands.map((strand) => (
                <div
                  key={strand.id}
                  className="cursor-pointer rounded-md border border-gray-200 p-3 hover:bg-gray-50"
                  onClick={() => handleStrandSelect(strand)}
                >
                  <div className="mb-2 font-medium">
                    {strand.summary || truncateContent(strand.content, 50)}
                  </div>
                  <div className="mb-2 text-sm text-gray-600">
                    {truncateContent(strand.content)}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {strand.tags.map((tag) => (
                      <div
                        key={tag}
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTagClick(tag);
                        }}
                      >
                        #{tag}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StrandEmbed;
