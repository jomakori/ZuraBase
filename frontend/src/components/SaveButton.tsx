import React from "react";
import { FloppyDisk } from "@phosphor-icons/react";

export type SaveState = "unsaved" | "saving" | "saved";

interface SaveButtonProps {
  saveState: SaveState;
  onClick: () => void;
  iconSize?: number;
  className?: string;
}

const SaveButton: React.FC<SaveButtonProps> = ({
  saveState,
  onClick,
  iconSize = 16,
  className = "",
}) => {
  const isDisabled = saveState === "saving" || saveState === "saved";

  const colorClasses =
    saveState === "unsaved"
      ? "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500"
      : saveState === "saving"
      ? "bg-yellow-500 focus:ring-yellow-500"
      : "bg-green-600 focus:ring-green-500 opacity-80";

  const cursorClasses =
    saveState === "unsaved"
      ? "cursor-pointer"
      : saveState === "saving"
      ? "cursor-wait"
      : "cursor-default";

  return (
    <button
      onClick={onClick}
      disabled={isDisabled}
      className={`save-button inline-flex items-center space-x-2 rounded px-3 py-2 text-sm font-medium text-white transition-colors duration-300 focus:outline-none focus:ring-2 focus:ring-offset-2 ${colorClasses} ${cursorClasses} ${className}`}
    >
      <FloppyDisk size={iconSize} />
      <span>
        {saveState === "saving"
          ? "Saving..."
          : saveState === "unsaved"
          ? "Save"
          : "Saved"}
      </span>
    </button>
  );
};

export default SaveButton;
