import React, { useRef, useState } from "react";
import { PaperPlaneTilt, File, X } from "@phosphor-icons/react";

interface FileUploadProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
}

/**
 * Component for selecting multiple files for upload
 */
const FileUpload: React.FC<FileUploadProps> = ({
  onFilesSelected,
  disabled = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(Array.from(e.target.files));
      // Reset the input to allow selecting the same files again
      e.target.value = "";
    }
  };

  const handleFiles = (files: File[]) => {
    // Filter files by allowed types (matching backend validation)
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
      "video/mp4",
      "video/mpeg",
      "video/quicktime",
      "video/webm",
      "application/pdf",
      "text/plain",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    const validFiles = files.filter((file) => {
      const isValid = allowedTypes.includes(file.type);
      if (!isValid) {
        console.warn(`File type not supported: ${file.type}`);
      }
      return isValid;
    });

    if (validFiles.length > 0) {
      onFilesSelected(validFiles);
    } else {
      console.warn("No valid files selected");
    }
  };

  const handleClick = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".jpg,.jpeg,.png,.gif,.webp,.mp4,.mpeg,.mov,.webm,.pdf,.txt,.doc,.docx"
        onChange={handleFileInputChange}
        className="hidden"
        disabled={disabled}
      />

      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
          dragActive
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 hover:border-gray-400"
        } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        onClick={handleClick}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center justify-center space-y-3">
          <PaperPlaneTilt
            size={32}
            className={dragActive ? "text-blue-500" : "text-gray-400"}
          />
          <div>
            <p className="text-sm font-medium text-gray-900">
              Drop files here or click to upload
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Supports images, videos, PDFs, and text files (max 10MB each)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FileUpload;
