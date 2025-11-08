import React from "react";
import { X, Warning, Info, CheckCircle, XCircle } from "@phosphor-icons/react";

export type DialogVariant = "info" | "success" | "warning" | "danger";

interface DialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  variant?: DialogVariant;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  showCancel?: boolean;
}

/**
 * Custom dialog component to replace browser-native alert/confirm dialogs
 */
const Dialog: React.FC<DialogProps> = ({
  isOpen,
  title,
  message,
  variant = "info",
  confirmText = "OK",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  showCancel = true,
}) => {
  if (!isOpen) return null;

  const variantStyles = {
    info: {
      icon: <Info size={24} className="text-blue-600" />,
      headerBg: "bg-blue-50",
      confirmBg: "bg-blue-600 hover:bg-blue-700",
    },
    success: {
      icon: <CheckCircle size={24} className="text-green-600" />,
      headerBg: "bg-green-50",
      confirmBg: "bg-green-600 hover:bg-green-700",
    },
    warning: {
      icon: <Warning size={24} className="text-yellow-600" />,
      headerBg: "bg-yellow-50",
      confirmBg: "bg-yellow-600 hover:bg-yellow-700",
    },
    danger: {
      icon: <XCircle size={24} className="text-red-600" />,
      headerBg: "bg-red-50",
      confirmBg: "bg-red-600 hover:bg-red-700",
    },
  };

  const styles = variantStyles[variant];

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 animate-fadeIn">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 animate-scaleIn">
        {/* Header */}
        <div
          className={`flex items-center gap-3 p-6 ${styles.headerBg} rounded-t-lg`}
        >
          {styles.icon}
          <h3 className="text-lg font-semibold text-gray-900 flex-1">
            {title}
          </h3>
          {onCancel && (
            <button
              onClick={handleCancel}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          <p className="text-gray-700 whitespace-pre-wrap">{message}</p>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 p-4 bg-gray-50 rounded-b-lg border-t border-gray-200">
          {showCancel && onCancel && (
            <button
              onClick={handleCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              {cancelText}
            </button>
          )}
          {onConfirm && (
            <button
              onClick={handleConfirm}
              className={`px-4 py-2 text-sm font-medium text-white rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors ${styles.confirmBg}`}
            >
              {confirmText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dialog;
