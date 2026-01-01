import React, { useEffect } from "react";
import { CheckCircle, XCircle, Info, Warning, X } from "@phosphor-icons/react";

export type ToastVariant = "info" | "success" | "warning" | "error";

interface ToastProps {
  isOpen: boolean;
  message: string;
  variant?: ToastVariant;
  duration?: number;
  onClose: () => void;
}

/**
 * Toast notification component for non-blocking status messages
 */
const Toast: React.FC<ToastProps> = ({
  isOpen,
  message,
  variant = "info",
  duration = 5000,
  onClose,
}) => {
  useEffect(() => {
    if (isOpen && duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [isOpen, duration, onClose]);

  if (!isOpen) return null;

  const variantStyles = {
    info: {
      icon: <Info size={20} className="text-blue-600" />,
      bg: "bg-blue-50 border-blue-200",
      text: "text-blue-800",
    },
    success: {
      icon: <CheckCircle size={20} className="text-green-600" />,
      bg: "bg-green-50 border-green-200",
      text: "text-green-800",
    },
    warning: {
      icon: <Warning size={20} className="text-yellow-600" />,
      bg: "bg-yellow-50 border-yellow-200",
      text: "text-yellow-800",
    },
    error: {
      icon: <XCircle size={20} className="text-red-600" />,
      bg: "bg-red-50 border-red-200",
      text: "text-red-800",
    },
  };

  const styles = variantStyles[variant];

  return (
    <div className="fixed top-4 right-4 z-50 animate-slideInRight">
      <div
        className={`flex items-center gap-3 p-4 rounded-lg shadow-lg border ${styles.bg} max-w-md`}
      >
        {styles.icon}
        <p className={`flex-1 text-sm font-medium ${styles.text}`}>{message}</p>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  );
};

export default Toast;
