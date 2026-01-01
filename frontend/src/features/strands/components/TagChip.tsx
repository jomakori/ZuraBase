import React from "react";
import { X } from "@phosphor-icons/react";

interface TagChipProps {
  tag: string;
  onRemove?: (tag: string) => void;
  onClick?: (tag: string) => void;
  className?: string;
  removable?: boolean;
  clickable?: boolean;
}

/**
 * A component for displaying a tag as a chip/badge
 */
const TagChip: React.FC<TagChipProps> = ({
  tag,
  onRemove,
  onClick,
  className = "",
  removable = false,
  clickable = false,
}) => {
  const handleClick = () => {
    if (clickable && onClick) {
      onClick(tag);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (removable && onRemove) {
      onRemove(tag);
    }
  };

  const uniqueKey = `${tag}-${Math.random().toString(36).substring(2, 8)}`;

  return (
    <div
      key={uniqueKey}
      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 ${
        clickable ? "cursor-pointer hover:bg-blue-200" : ""
      } ${className}`}
      onClick={handleClick}
    >
      {tag.startsWith("#") ? tag : `#${tag}`}
      {removable && (
        <button
          type="button"
          className="ml-1 flex-shrink-0 inline-flex items-center justify-center h-4 w-4 rounded-full bg-blue-200 hover:bg-blue-300 focus:outline-none focus:bg-blue-500"
          onClick={handleRemove}
          aria-label={`Remove ${tag} tag`}
        >
          <X size={12} weight="bold" />
        </button>
      )}
    </div>
  );
};

export default TagChip;
