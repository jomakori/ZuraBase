import React, { useState, useEffect, useRef } from "react";
import { useTags } from "./hooks";

interface TagFilterProps {
  onTagSelect: (tag: string) => void;
  selectedTags: string[];
}

/**
 * Component for filtering strands by tags with hashtag detection
 */
const TagFilter: React.FC<TagFilterProps> = ({ onTagSelect, selectedTags }) => {
  const [searchInput, setSearchInput] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [filteredTags, setFilteredTags] = useState<string[]>([]);
  const { tags, loading } = useTags();
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter tags based on input
  useEffect(() => {
    if (searchInput.startsWith("#")) {
      const query = searchInput.slice(1).toLowerCase();
      const filtered = tags
        .filter(
          (tag) =>
            tag.toLowerCase().includes(query) && !selectedTags.includes(tag)
        )
        .slice(0, 10); // Limit to 10 suggestions
      setFilteredTags(filtered);
      setShowDropdown(filtered.length > 0);
    } else {
      setShowDropdown(false);
    }
  }, [searchInput, tags, selectedTags]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
  };

  const handleTagClick = (tag: string) => {
    onTagSelect(tag);
    setSearchInput("");
    setShowDropdown(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && filteredTags.length > 0 && showDropdown) {
      handleTagClick(filteredTags[0]);
      e.preventDefault();
    } else if (e.key === "Escape" && showDropdown) {
      setShowDropdown(false);
      e.preventDefault();
    }
  };

  return (
    <div className="relative">
      <div className="flex items-center border border-gray-300 rounded-md px-3 py-2 bg-white">
        <input
          ref={inputRef}
          type="text"
          className="flex-grow outline-none"
          placeholder="Type # to filter by tag..."
          value={searchInput}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
        />
      </div>

      {/* Tag suggestions dropdown */}
      {showDropdown && (
        <div
          ref={dropdownRef}
          className="absolute z-10 mt-1 w-full bg-white shadow-lg rounded-md py-1 max-h-60 overflow-auto"
        >
          {loading ? (
            <div className="px-4 py-2 text-sm text-gray-500">
              Loading tags...
            </div>
          ) : filteredTags.length === 0 ? (
            <div className="px-4 py-2 text-sm text-gray-500">
              No matching tags
            </div>
          ) : (
            filteredTags.map((tag) => (
              <div
                key={tag}
                className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm"
                onClick={() => handleTagClick(tag)}
              >
                #{tag}
              </div>
            ))
          )}
        </div>
      )}

      {/* Selected tags */}
      {selectedTags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {selectedTags.map((tag) => (
            <div
              key={tag}
              className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
            >
              #{tag}
              <button
                type="button"
                className="ml-1 flex-shrink-0 inline-flex items-center justify-center h-4 w-4 rounded-full bg-blue-200 hover:bg-blue-300 focus:outline-none"
                onClick={() => onTagSelect(tag)} // Clicking again removes the tag
                aria-label={`Remove ${tag} tag`}
              >
                <span className="text-xs">×</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TagFilter;
