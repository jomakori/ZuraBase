import React from "react";
import { CheckCircle, XCircle, Clock } from "@phosphor-icons/react";

interface UploadProgressItem {
  fileName: string;
  progress: number; // 0-100
  status: "uploading" | "completed" | "error";
  error?: string;
}

interface UploadProgressProps {
  uploads: UploadProgressItem[];
  onCancel?: (fileName: string) => void;
}

/**
 * Component for displaying file upload progress
 */
const UploadProgress: React.FC<UploadProgressProps> = ({
  uploads,
  onCancel,
}) => {
  if (uploads.length === 0) {
    return null;
  }

  const getStatusIcon = (status: UploadProgressItem["status"]) => {
    switch (status) {
      case "completed":
        return <CheckCircle size={16} className="text-green-500" />;
      case "error":
        return <XCircle size={16} className="text-red-500" />;
      case "uploading":
      default:
        return <Clock size={16} className="text-blue-500" />;
    }
  };

  const getStatusText = (status: UploadProgressItem["status"]) => {
    switch (status) {
      case "completed":
        return "Completed";
      case "error":
        return "Failed";
      case "uploading":
      default:
        return "Uploading...";
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
        <h3 className="text-sm font-medium text-gray-900">
          Uploading Files ({uploads.length})
        </h3>
      </div>

      <div className="divide-y divide-gray-200">
        {uploads.map((upload, index) => (
          <div key={index} className="px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2 min-w-0 flex-1">
                {getStatusIcon(upload.status)}
                <span className="text-sm font-medium text-gray-900 truncate">
                  {upload.fileName}
                </span>
              </div>

              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-500 whitespace-nowrap">
                  {getStatusText(upload.status)}
                </span>
                {upload.status === "uploading" && onCancel && (
                  <button
                    onClick={() => onCancel(upload.fileName)}
                    className="text-xs text-red-600 hover:text-red-800"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>

            {upload.status === "uploading" && (
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${upload.progress}%` }}
                />
              </div>
            )}

            {upload.status === "error" && upload.error && (
              <p className="text-xs text-red-600 mt-1">{upload.error}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default UploadProgress;
