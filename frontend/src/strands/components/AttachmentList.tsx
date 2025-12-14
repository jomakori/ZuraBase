import React from "react";
import {
  File,
  Image,
  Video,
  Trash,
  Download,
  Eye,
} from "@phosphor-icons/react";
import { FileAttachment } from "../types";

interface AttachmentListProps {
  attachments: FileAttachment[];
  onDelete?: (attachmentId: string) => void;
  onView?: (attachment: FileAttachment) => void;
  disabled?: boolean;
}

/**
 * Component for displaying uploaded attachments with view/download and delete options
 */
const AttachmentList: React.FC<AttachmentListProps> = ({
  attachments,
  onDelete,
  onView,
  disabled = false,
}) => {
  if (attachments.length === 0) {
    return null;
  }

  const getFileIcon = (mimeType: string) => {
    if (mimeType.startsWith("image/")) {
      return <Image size={20} className="text-blue-500" />;
    } else if (mimeType.startsWith("video/")) {
      return <Video size={20} className="text-purple-500" />;
    } else {
      return <File size={20} className="text-gray-500" />;
    }
  };

  const getFileType = (mimeType: string) => {
    if (mimeType.startsWith("image/")) {
      return "Image";
    } else if (mimeType.startsWith("video/")) {
      return "Video";
    } else if (mimeType === "application/pdf") {
      return "PDF";
    } else if (mimeType.startsWith("text/")) {
      return "Text";
    } else if (mimeType.includes("word")) {
      return "Document";
    } else {
      return "File";
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleDownload = (attachment: FileAttachment) => {
    // Create a temporary link to trigger download
    const link = document.createElement("a");
    link.href = attachment.url;
    link.download = attachment.original_name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleView = (attachment: FileAttachment) => {
    if (onView) {
      onView(attachment);
    } else {
      // Default behavior: open in new tab
      window.open(attachment.url, "_blank");
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h3 className="text-sm font-medium text-gray-900">
          Attachments ({attachments.length})
        </h3>
      </div>

      <div className="divide-y divide-gray-200">
        {attachments.map((attachment) => (
          <div key={attachment.id} className="px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3 min-w-0 flex-1">
                {getFileIcon(attachment.mime_type)}

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {attachment.original_name}
                  </p>
                  <div className="flex items-center space-x-2 text-xs text-gray-500">
                    <span>{getFileType(attachment.mime_type)}</span>
                    <span>•</span>
                    <span>{formatFileSize(attachment.size)}</span>
                    <span>•</span>
                    <span>{formatDate(attachment.uploaded_at)}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2 ml-4">
                {/* View button - only for images and videos */}
                {(attachment.mime_type.startsWith("image/") ||
                  attachment.mime_type.startsWith("video/")) && (
                  <button
                    onClick={() => handleView(attachment)}
                    className="p-1 text-gray-400 hover:text-blue-600 transition-colors"
                    title="View"
                    disabled={disabled}
                  >
                    <Eye size={16} />
                  </button>
                )}

                {/* Download button */}
                <button
                  onClick={() => handleDownload(attachment)}
                  className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                  title="Download"
                  disabled={disabled}
                >
                  <Download size={16} />
                </button>

                {/* Delete button */}
                {onDelete && (
                  <button
                    onClick={() => onDelete(attachment.id)}
                    className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                    title="Delete"
                    disabled={disabled}
                  >
                    <Trash size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AttachmentList;
