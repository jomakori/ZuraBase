import React, { useState } from "react";
import { Strand } from "../types";
import { useStrands } from "../hooks";
import { MagnifyingGlass, X, Link } from "@phosphor-icons/react";

interface StrandTaskLinkProps {
  onSelect: (strand: Strand) => void;
  selectedStrandId?: string;
  readOnly?: boolean;
}

/**
 * Component for linking a strand to a planner task
 */
const StrandTaskLink: React.FC<StrandTaskLinkProps> = ({
  onSelect,
  selectedStrandId,
  readOnly = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { strands, loading } = useStrands({});
  const [filteredStrands, setFilteredStrands] = useState<Strand[]>([]);

  // Get the selected strand if there is one
  const selectedStrand = strands.find((s) => s.id === selectedStrandId);

  // Handle search input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);

    if (!query.trim()) {
      setFilteredStrands([]);
      return;
    }

    // Filter strands based on search query
    const filtered = strands.filter(
      (strand) =>
        strand.content.toLowerCase().includes(query.toLowerCase()) ||
        strand.summary.toLowerCase().includes(query.toLowerCase()) ||
        strand.tags.some((tag) =>
          tag.toLowerCase().includes(query.toLowerCase())
        )
    );
    setFilteredStrands(filtered);
  };

  // Handle strand selection
  const handleStrandSelect = (strand: Strand) => {
    onSelect(strand);
    setIsOpen(false);
    setSearchQuery("");
    setFilteredStrands([]);
  };

  // Handle removing the selected strand
  const handleRemoveStrand = () => {
    onSelect({
      id: "",
      user_id: "",
      content: "",
      source: "",
      tags: [],
      summary: "",
      related_ids: [],
      created_at: "",
      updated_at: "",
    });
  };

  // Truncate content for preview
  const truncateContent = (content: string, maxLength = 100) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + "...";
  };

  if (readOnly && !selectedStrand) {
    return null;
  }

  return (
    <div className="mt-2">
      {selectedStrand ? (
        <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="mb-1 flex items-center">
                <Link size={14} className="mr-1 text-blue-600" />
                <span className="text-sm font-medium text-blue-600">
                  Linked Strand
                </span>
              </div>
              <div className="text-sm font-medium">
                {selectedStrand.summary ||
                  truncateContent(selectedStrand.content, 50)}
              </div>
              {!readOnly && (
                <button
                  onClick={handleRemoveStrand}
                  className="mt-1 text-xs text-red-600 hover:text-red-800"
                >
                  Remove link
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        !readOnly && (
          <div className="relative">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="flex items-center text-sm text-blue-600 hover:text-blue-800"
            >
              <Link size={16} className="mr-1" />
              Link a strand
            </button>

            {isOpen && (
              <div className="absolute z-10 mt-1 w-64 rounded-md border border-gray-200 bg-white p-2 shadow-lg">
                <div className="mb-2 flex items-center">
                  <MagnifyingGlass size={16} className="mr-1 text-gray-400" />
                  <input
                    type="text"
                    className="w-full border-none p-1 text-sm focus:outline-none"
                    placeholder="Search strands..."
                    value={searchQuery}
                    onChange={handleSearchChange}
                  />
                  <button
                    onClick={() => setIsOpen(false)}
                    className="ml-1 rounded-full p-1 hover:bg-gray-100"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="max-h-48 overflow-y-auto">
                  {loading ? (
                    <div className="flex justify-center py-2">
                      <div className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-blue-600 border-r-transparent"></div>
                    </div>
                  ) : filteredStrands.length === 0 ? (
                    searchQuery ? (
                      <div className="py-2 text-center text-xs text-gray-500">
                        No strands found
                      </div>
                    ) : null
                  ) : (
                    <div className="space-y-1">
                      {filteredStrands.map((strand) => (
                        <div
                          key={strand.id}
                          className="cursor-pointer rounded p-2 text-xs hover:bg-gray-100"
                          onClick={() => handleStrandSelect(strand)}
                        >
                          {strand.summary ||
                            truncateContent(strand.content, 50)}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
};

export default StrandTaskLink;
