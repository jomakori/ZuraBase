import React from "react";
import {
  ArrowsClockwise,
  CheckCircle,
  XCircle,
  X,
  Warning,
} from "@phosphor-icons/react";

export interface AIStep {
  id: string;
  label: string;
  status: "pending" | "active" | "completed" | "error";
  timestamp: Date;
  details?: string;
  modelOverride?: boolean;
  modelUsed?: string;
  overrideReason?: string;
}

export interface SyncProgress {
  total: number;
  completed: number;
  failed: number;
  currentItem?: string;
  status: "syncing" | "completed" | "error" | "cancelled";
  message?: string;
  currentOperation?: string;
  aiSteps?: AIStep[]; // Detailed AI operation steps for the current item
  processingMessage?: string; // Processing context for the current item
  // URL processing information
  detectedUrlCount?: number; // Total URLs detected in current strand
  extractedUrlCount?: number; // Successfully extracted URLs
  unsupportedUrlCount?: number; // URLs unsupported by Firecrawl
  urlProcessingMessage?: string; // Message about URL processing status
  strandProgress?: {
    strandId: string;
    strandTitle: string;
    status: "pending" | "active" | "completed" | "error" | "cancelled";
    message?: string;
    aiSteps?: AIStep[]; // AI steps for this specific strand
    processingMessage?: string; // Thinking message for this specific strand
    // URL processing information for individual strands
    detectedUrlCount?: number;
    extractedUrlCount?: number;
    unsupportedUrlCount?: number;
    urlProcessingMessage?: string;
  }[]; // Progress for individual strands in multi-sync
}

interface SyncProgressModalProps {
  isOpen: boolean;
  progress?: SyncProgress | null;
  onClose: () => void;
  onCancel?: () => void;
  canCancel?: boolean;
}

/**
 * Enhanced modal component to display sync progress for multiple strands
 * with real-time progress indicators and cancellation support
 */
const SyncProgressModal: React.FC<SyncProgressModalProps> = ({
  isOpen,
  progress,
  onClose,
  onCancel,
  canCancel = true,
}) => {
  if (!isOpen) return null;

  // Default progress if not provided
  const defaultProgress: SyncProgress = {
    total: 0,
    completed: 0,
    failed: 0,
    status: 'syncing',
  };

  const currentProgress = progress || defaultProgress;

  const percentage =
    currentProgress.total > 0
      ? Math.round((currentProgress.completed / currentProgress.total) * 100)
      : 0;

  const isComplete = currentProgress.status === "completed";
  const hasError = currentProgress.status === "error";
  const isSyncing = currentProgress.status === "syncing";
  const isCancelled = currentProgress.status === "cancelled";

  const successCount = currentProgress.completed - currentProgress.failed;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 animate-fadeIn">
      <div
        className="bg-white rounded-lg shadow-xl max-w-lg w-full mx-4 animate-scaleIn"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sync-modal-title"
        aria-describedby="sync-modal-description"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            {isSyncing && (
              <div className="h-6 w-6 animate-spin rounded-full border-3 border-solid border-blue-600 border-r-transparent"></div>
            )}
            {isComplete && (
              <CheckCircle size={24} className="text-green-600" weight="fill" />
            )}
            {hasError && (
              <XCircle size={24} className="text-red-600" weight="fill" />
            )}
            {isCancelled && (
              <Warning size={24} className="text-yellow-600" weight="fill" />
            )}
            <h3 id="sync-modal-title" className="text-lg font-semibold text-gray-900">
              {isSyncing && (currentProgress.currentOperation || "Syncing Strands")}
              {isComplete && "Sync Complete"}
              {hasError && "Sync Error"}
              {isCancelled && "Sync Cancelled"}
            </h3>
          </div>
          {(isComplete || hasError || isCancelled) && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close"
            >
              <X size={20} />
            </button>
          )}
        </div>

        {/* Content */}
        <div id="sync-modal-description" className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Overall Progress Bar */}
          <div>
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>
                {currentProgress.completed} of {currentProgress.total} strands processed
              </span>
              <span className="font-medium">{percentage}%</span>
            </div>
            <div
              className="w-full bg-gray-200 rounded-full h-3 overflow-hidden shadow-inner"
              role="progressbar"
              aria-valuenow={percentage}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Sync progress"
            >
              <div
                className={`h-full transition-all duration-300 rounded-full ${
                  hasError
                    ? "bg-red-500"
                    : isCancelled
                    ? "bg-yellow-500"
                    : isComplete
                    ? "bg-green-500"
                    : "bg-blue-600"
                } ${isSyncing ? "animate-pulse" : ""}`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>

          {/* Multi-strand Progress View */}
          {currentProgress.strandProgress && currentProgress.strandProgress.length > 1 && (
            <div className="space-y-3">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Individual Strand Progress
              </div>
              {currentProgress.strandProgress.map((strand) => (
                <div
                  key={strand.strandId}
                  className={`flex items-center gap-3 p-3 rounded-md border transition-all ${
                    strand.status === "active"
                      ? "bg-blue-50 border-blue-200"
                      : strand.status === "completed"
                      ? "bg-green-50 border-green-200"
                      : strand.status === "error"
                      ? "bg-red-50 border-red-200"
                      : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <div className="flex-shrink-0">
                    {strand.status === "active" && (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-blue-600 border-r-transparent"></div>
                    )}
                    {strand.status === "completed" && (
                      <CheckCircle
                        size={16}
                        className="text-green-600"
                        weight="fill"
                      />
                    )}
                    {strand.status === "error" && (
                      <XCircle
                        size={16}
                        className="text-red-600"
                        weight="fill"
                      />
                    )}
                    {strand.status === "pending" && (
                      <div className="h-4 w-4 rounded-full border-2 border-gray-300"></div>
                    )}
                    {strand.status === "cancelled" && (
                      <Warning
                        size={16}
                        className="text-yellow-600"
                        weight="fill"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div
                      className={`text-sm font-medium ${
                        strand.status === "active"
                          ? "text-blue-900"
                          : strand.status === "completed"
                          ? "text-green-900"
                          : strand.status === "error"
                          ? "text-red-900"
                          : "text-gray-600"
                      }`}
                    >
                      {strand.strandTitle}
                    </div>
                    {strand.message && (
                      <div className="text-xs text-gray-600 mt-1">
                        {strand.message}
                      </div>
                    )}
                    {/* Nested AI Steps for the active strand in multi-sync */}
                    {strand.status === "active" &&
                      strand.aiSteps &&
                      strand.aiSteps.length > 0 && (
                        <div className="mt-3 space-y-2 pl-4 border-l border-gray-200">
                          {strand.aiSteps.map((step) => (
                            <div
                              key={step.id}
                              className="flex items-start gap-2"
                            >
                              <div className="flex-shrink-0 mt-0.5">
                                {step.status === "active" && (
                                  <div className="h-3 w-3 animate-spin rounded-full border border-solid border-blue-500 border-r-transparent"></div>
                                )}
                                {step.status === "completed" && (
                                  <CheckCircle
                                    size={12}
                                    className="text-green-500"
                                    weight="fill"
                                  />
                                )}
                                {step.status === "error" && (
                                  <XCircle
                                    size={12}
                                    className="text-red-500"
                                    weight="fill"
                                  />
                                )}
                                {step.status === "pending" && (
                                  <div className="h-3 w-3 rounded-full border border-gray-300"></div>
                                )}
                              </div>
                              <div className="flex-1 text-xs text-gray-700">
                                {step.label}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    {/* URL processing info for individual strands */}
                    {(strand.detectedUrlCount !== undefined ||
                      strand.extractedUrlCount !== undefined ||
                      strand.unsupportedUrlCount !== undefined) && (
                      <div className="mt-2 space-y-1">
                        {strand.detectedUrlCount !== undefined && (
                          <div className="flex items-center gap-1 text-xs text-gray-600">
                            <span className="font-medium">URLs:</span>
                            <span>{strand.detectedUrlCount} detected</span>
                          </div>
                        )}
                        {strand.extractedUrlCount !== undefined && (
                          <div className="flex items-center gap-1 text-xs text-green-600">
                            <span className="font-medium">Extracted:</span>
                            <span>{strand.extractedUrlCount}</span>
                          </div>
                        )}
                        {strand.unsupportedUrlCount !== undefined && strand.unsupportedUrlCount > 0 && (
                          <div className="flex items-center gap-1 text-xs text-amber-600">
                            <span className="font-medium">Unsupported:</span>
                            <span>{strand.unsupportedUrlCount}</span>
                          </div>
                        )}
                      </div>
                    )}
                    {strand.status === "active" && strand.processingMessage && (
                      <div className="mt-2 text-xs italic text-blue-700">
                        AI Thinking: {strand.processingMessage}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Single Strand AI Operation Steps - ChatGPT-like thinking display */}
          {currentProgress.total === 1 &&
            isSyncing &&
            currentProgress.aiSteps &&
            currentProgress.aiSteps.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                  AI Processing Steps
                </div>
                {currentProgress.aiSteps.map((step) => (
                  <div
                    key={step.id}
                    className={`flex items-start gap-3 p-3 rounded-md transition-all ${
                      step.status === "active"
                        ? "bg-blue-50 border border-blue-200"
                        : step.status === "completed"
                        ? "bg-green-50 border border-green-200"
                        : step.status === "error"
                        ? "bg-red-50 border border-red-200"
                        : "bg-gray-50 border border-gray-200"
                    }`}
                  >
                    <div className="flex-shrink-0 mt-0.5">
                      {step.status === "active" && (
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-solid border-blue-600 border-r-transparent"></div>
                      )}
                      {step.status === "completed" && (
                        <CheckCircle
                          size={16}
                          className="text-green-600"
                          weight="fill"
                        />
                      )}
                      {step.status === "error" && (
                        <XCircle
                          size={16}
                          className="text-red-600"
                          weight="fill"
                        />
                      )}
                      {step.status === "pending" && (
                        <div className="h-4 w-4 rounded-full border-2 border-gray-300"></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-sm font-medium ${
                          step.status === "active"
                            ? "text-blue-900"
                            : step.status === "completed"
                            ? "text-green-900"
                            : step.status === "error"
                            ? "text-red-900"
                            : "text-gray-600"
                        }`}
                      >
                        {step.label}
                      </div>
                      {step.details && (
                        <div className="text-xs text-gray-600 mt-1">
                          {step.details}
                        </div>
                      )}
                      {step.modelOverride && step.status === "completed" && (
                        <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
                          <div className="flex items-center gap-1 text-xs text-yellow-800">
                            <span className="font-medium">Model Override:</span>
                            <span>
                              {step.overrideReason || "Media content detected"}
                            </span>
                          </div>
                          {step.modelUsed && (
                            <div className="text-xs text-yellow-700 mt-1">
                              Using model:{" "}
                              <span className="font-medium">
                                {step.modelUsed}
                              </span>
                            </div>
                          )}
                        </div>
                      )}
                      {step.status === "active" && (
                        <div className="flex items-center gap-1 mt-1">
                          <div className="flex gap-1">
                            <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce"></div>
                            <div
                              className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce"
                              style={{ animationDelay: "0.1s" }}
                            ></div>
                            <div
                              className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-bounce"
                              style={{ animationDelay: "0.2s" }}
                            ></div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

          {/* Thinking Message - Similar to ChatGPT's thinking indicator */}
          {currentProgress.total === 1 && isSyncing && currentProgress.processingMessage && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-md border border-blue-200">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-solid border-blue-600 border-r-transparent"></div>
                </div>
                <div className="flex-1">
                  <div className="text-xs font-medium text-blue-900 uppercase tracking-wide mb-1">
                    AI Thinking
                  </div>
                  <div className="text-sm text-blue-800 italic">
                    {currentProgress.processingMessage}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* URL Processing Information */}
          {(currentProgress.detectedUrlCount !== undefined ||
            currentProgress.extractedUrlCount !== undefined ||
            currentProgress.unsupportedUrlCount !== undefined) && (
            <div className="space-y-2 animate-fadeIn">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Processing URLs...
              </div>
              <div className="bg-gray-50 p-3 rounded-md border border-gray-200 transition-all duration-300 hover:bg-gray-100">
                {/* Detected URLs */}
                {currentProgress.detectedUrlCount !== undefined && (
                  <div className="flex items-center justify-between mb-2 transition-all duration-300">
                    <div className="text-sm text-gray-700">Detected URLs</div>
                    <div className="text-sm font-medium text-gray-900 animate-pulse">
                      {currentProgress.detectedUrlCount}
                    </div>
                  </div>
                )}
                {/* Successfully extracted URLs */}
                {currentProgress.extractedUrlCount !== undefined && (
                  <div className="flex items-center justify-between mb-2 transition-all duration-300">
                    <div className="text-sm text-gray-700">Successfully extracted</div>
                    <div className="text-sm font-medium text-green-600 animate-bounce">
                      {currentProgress.extractedUrlCount}
                    </div>
                  </div>
                )}
                {/* Unsupported URLs */}
                {currentProgress.unsupportedUrlCount !== undefined && currentProgress.unsupportedUrlCount > 0 && (
                  <>
                    <div className="flex items-center justify-between mb-2 transition-all duration-300">
                      <div className="text-sm text-gray-700">Unsupported by Firecrawl</div>
                      <div className="text-sm font-medium text-amber-600 animate-pulse">
                        {currentProgress.unsupportedUrlCount}
                      </div>
                    </div>
                    <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-md transition-all duration-300 hover:bg-amber-100">
                      <div className="flex items-center gap-1 text-xs text-amber-800">
                        <Warning size={12} className="text-amber-600" weight="fill" />
                        <span className="font-medium">Warning:</span>
                        <span>{currentProgress.unsupportedUrlCount} URL(s) could not be processed by Firecrawl. The AI will analyze the remaining content.</span>
                      </div>
                    </div>
                  </>
                )}
                {/* URL processing message */}
                {currentProgress.urlProcessingMessage && (
                  <div className="mt-2 text-xs text-gray-600 italic transition-all duration-300">
                    {currentProgress.urlProcessingMessage}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Current Item (for single strand sync) */}
          {currentProgress.total === 1 && isSyncing && currentProgress.currentItem && (
            <div className="bg-gray-50 p-3 rounded-md border border-gray-200">
              <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Current Strand
              </div>
              <div className="text-sm text-gray-800 font-medium">
                {currentProgress.currentItem}
              </div>
            </div>
          )}

          {/* Status Message */}
          {currentProgress.message && !isSyncing && (
            <div
              className={`p-3 rounded-md text-sm ${
                hasError
                  ? "bg-red-50 text-red-800 border border-red-200"
                  : isComplete
                  ? "bg-green-50 text-green-800 border border-green-200"
                  : "bg-blue-50 text-blue-800 border border-blue-200"
              }`}
            >
              {currentProgress.message}
            </div>
          )}

          {/* Stats */}
          {(isComplete || hasError || isCancelled) && (
            <div className="flex gap-4 text-sm">
              {successCount > 0 && (
                <div className="flex items-center gap-1">
                  <CheckCircle
                    size={16}
                    className="text-green-600"
                    weight="fill"
                  />
                  <span className="text-gray-600">
                    {successCount} successful
                  </span>
                </div>
              )}
              {currentProgress.failed > 0 && (
                <div className="flex items-center gap-1">
                  <XCircle size={16} className="text-red-600" weight="fill" />
                  <span className="text-gray-600">
                    {currentProgress.failed} failed
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 p-4 bg-gray-50 rounded-b-lg border-t border-gray-200">
          {isSyncing && canCancel && onCancel && (
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
            >
              Cancel Sync
            </button>
          )}
          {(isComplete || hasError || isCancelled) && (
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SyncProgressModal;
