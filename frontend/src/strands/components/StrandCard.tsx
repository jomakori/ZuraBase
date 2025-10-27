import React from "react";
import { Strand } from "../types";
import TagChip from "./TagChip";
import { CalendarBlank, Trash, PencilSimple } from "@phosphor-icons/react";

interface StrandCardProps {
  strand: Strand;
  onTagClick?: (tag: string) => void;
  onEdit?: (strand: Strand) => void;
  onDelete?: (strand: Strand) => void;
}

/**
 * A card component for displaying a strand in a list
 */
const StrandCard: React.FC<StrandCardProps> = ({
  strand,
  onTagClick,
  onEdit,
  onDelete,
}) => {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const truncateContent = (content: string, maxLength = 150) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + "...";
  };

  const handleEdit = () => {
    if (onEdit) {
      onEdit(strand);
    }
  };

  const handleDelete = () => {
    if (onDelete) {
      onDelete(strand);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300">
      <div className="p-4">
        {/* Summary as title */}
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {strand.summary || truncateContent(strand.content, 50)}
        </h3>

        {/* Content preview */}
        <p className="text-gray-600 mb-4">{truncateContent(strand.content)}</p>

        {/* Tags */}
        <div className="flex flex-wrap gap-2 mb-4">
          {strand.tags.map((tag, index) => (
            <TagChip
              key={`${tag}-${index}`}
              tag={tag}
              clickable={!!onTagClick}
              onClick={onTagClick}
            />
          ))}
        </div>

        {/* Footer with metadata and actions */}
        <div className="flex justify-between items-center text-sm text-gray-500">
          <div className="flex items-center">
            <CalendarBlank size={16} className="mr-1" />
            <span>{formatDate(strand.created_at)}</span>
            <span className="mx-2 text-gray-300">|</span>
            <span className="capitalize">{strand.source}</span>
          </div>

          <div className="flex space-x-2">
            {onEdit && (
              <button
                onClick={handleEdit}
                className="p-1 rounded hover:bg-gray-100"
                aria-label="Edit strand"
              >
                <PencilSimple size={18} className="text-blue-600" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={handleDelete}
                className="p-1 rounded hover:bg-gray-100"
                aria-label="Delete strand"
              >
                <Trash size={18} className="text-red-600" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default StrandCard;
