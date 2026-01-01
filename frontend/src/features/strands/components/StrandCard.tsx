import React from "react";
import { Strand } from "../types";
import TagChip from "./TagChip";
import {
  CalendarBlank,
  Trash,
  PencilSimple,
  ArrowsClockwise,
} from "@phosphor-icons/react";

interface StrandCardProps {
  strand: Strand;
  onTagClick?: (tag: string) => void;
  onEdit?: (strand: Strand) => void;
  onDelete?: (strand: Strand) => void;
  onSync?: (strand: Strand) => void;
}

/**
 * A card component for displaying a strand in a list
 */
const StrandCard: React.FC<StrandCardProps> = ({
  strand,
  onTagClick,
  onEdit,
  onDelete,
  onSync,
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

  const handleSync = () => {
    if (onSync) {
      onSync(strand);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow duration-300">
      <div className="p-4">
        {/* Header with title and sync status */}
        <div className="flex justify-between items-start mb-2 gap-2">
          <h3 className="text-lg font-semibold text-gray-900 flex-1 min-w-0 break-words">
            {strand.summary || truncateContent(strand.content, 50)}
          </h3>

          {/* Unsynced badge */}
          {!strand.synced_with_ai && (
            <div className="flex items-center gap-1 flex-shrink-0">
              <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 border border-yellow-200 whitespace-nowrap">
                <ArrowsClockwise size={12} className="mr-1 flex-shrink-0" />
                Unsynced
              </span>
              {onSync && (
                <button
                  onClick={handleSync}
                  className="p-1 rounded hover:bg-yellow-50 text-yellow-600 flex-shrink-0"
                  aria-label="Sync strand with AI"
                  title="Sync with AI"
                >
                  <ArrowsClockwise size={14} />
                </button>
              )}
            </div>
          )}
        </div>

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
