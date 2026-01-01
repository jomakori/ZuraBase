import React from "react";
import { Strand } from "../types";
import { Link } from "@phosphor-icons/react";

interface StrandReferenceProps {
  strand: Strand;
  onClick?: () => void;
}

/**
 * Component for displaying a strand reference in a note
 */
const StrandReference: React.FC<StrandReferenceProps> = ({
  strand,
  onClick,
}) => {
  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  // Truncate content for preview
  const truncateContent = (content: string, maxLength = 150) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + "...";
  };

  return (
    <div
      className="my-4 rounded-md border border-gray-200 bg-gray-50 p-4 hover:bg-gray-100"
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="mb-2 flex items-center">
            <Link size={16} className="mr-2 text-blue-600" />
            <span className="font-medium text-blue-600">Linked Strand</span>
            <span className="ml-2 text-xs text-gray-500">
              {formatDate(strand.created_at)}
            </span>
          </div>
          <div className="mb-2 font-medium">
            {strand.summary || truncateContent(strand.content, 50)}
          </div>
          <div className="text-sm text-gray-600">
            {truncateContent(strand.content)}
          </div>
        </div>
      </div>
      {strand.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {strand.tags.map((tag) => (
            <div
              key={tag}
              className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800"
            >
              #{tag}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StrandReference;
