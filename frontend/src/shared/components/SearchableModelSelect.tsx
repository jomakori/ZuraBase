import React, { useState, useRef, useEffect } from "react";
import { CaretDown, MagnifyingGlass } from "@phosphor-icons/react";

interface SearchableModelSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  disabled?: boolean;
  loading?: boolean;
  placeholder?: string;
  className?: string;
}

/**
 * Searchable dropdown component for model selection
 * Provides filtering and keyboard navigation
 */
export const SearchableModelSelect: React.FC<SearchableModelSelectProps> = ({
  value,
  onChange,
  options,
  disabled = false,
  loading = false,
  placeholder = "Select a model",
  className = "",
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter options based on search term
  const filteredOptions = options.filter((option) =>
    option.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen]);

  // Reset search and highlighted index when dropdown closes
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm("");
      setHighlightedIndex(0);
    }
  }, [isOpen]);

  const handleSelect = (option: string) => {
    onChange(option);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightedIndex((prev) =>
          prev < filteredOptions.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case "Enter":
        e.preventDefault();
        if (filteredOptions[highlightedIndex]) {
          handleSelect(filteredOptions[highlightedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  if (loading) {
    return (
      <div
        className={`w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 bg-gray-50 ${className}`}
      >
        <div className="flex items-center justify-between">
          <span className="text-gray-500">Loading models...</span>
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-gray-600 border-r-transparent"></div>
        </div>
      </div>
    );
  }

  return (
    <div ref={dropdownRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        className={`w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 text-left focus:outline-none focus:ring-blue-500 focus:border-blue-500 ${
          disabled
            ? "bg-gray-100 cursor-not-allowed"
            : "bg-white cursor-pointer"
        }`}
      >
        <div className="flex items-center justify-between">
          <span className={value ? "text-gray-900" : "text-gray-500"}>
            {value || placeholder}
          </span>
          <CaretDown
            size={16}
            className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-hidden">
          <div className="p-2 border-b border-gray-200">
            <div className="relative">
              <MagnifyingGlass
                size={16}
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setHighlightedIndex(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder="Search models..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="max-h-48 overflow-y-auto">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500 text-center">
                No models found
              </div>
            ) : (
              filteredOptions.map((option, index) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleSelect(option)}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-blue-50 ${
                    index === highlightedIndex ? "bg-blue-50" : ""
                  } ${value === option ? "bg-blue-100 font-medium" : ""}`}
                >
                  {option}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
