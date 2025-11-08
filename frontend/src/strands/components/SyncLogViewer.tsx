import React, { useState } from "react";
import { SyncLog } from "../types";
import {
  Clock,
  ArrowsClockwise,
  Tag,
  ArrowCounterClockwise,
} from "@phosphor-icons/react";

interface SyncLogViewerProps {
  syncHistory: SyncLog[];
  onRollback?: (log: SyncLog) => void;
}

/**
 * Component for displaying sync history logs
 */
const SyncLogViewer: React.FC<SyncLogViewerProps> = ({
  syncHistory,
  onRollback,
}) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
  const [rollbackConfirm, setRollbackConfirm] = useState<number | null>(null);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const truncateSummary = (summary: string, maxLength = 100) => {
    if (summary.length <= maxLength) return summary;
    return summary.substring(0, maxLength) + "...";
  };

  const handleToggleExpand = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  const handleRollbackClick = (index: number) => {
    setRollbackConfirm(index);
  };

  const handleConfirmRollback = (log: SyncLog) => {
    if (onRollback) {
      onRollback(log);
    }
    setRollbackConfirm(null);
  };

  const handleCancelRollback = () => {
    setRollbackConfirm(null);
  };

  /**
   * Compare tags between two sync logs
   */
  const getTagDiff = (currentTags: string[], previousTags: string[]) => {
    const added = currentTags.filter((tag) => !previousTags.includes(tag));
    const removed = previousTags.filter((tag) => !currentTags.includes(tag));
    const unchanged = currentTags.filter((tag) => previousTags.includes(tag));

    return { added, removed, unchanged };
  };

  /**
   * Get summary diff preview
   */
  const getSummaryDiff = (currentSummary: string, previousSummary: string) => {
    if (currentSummary === previousSummary) {
      return { type: "unchanged" as const, text: "No changes" };
    }

    // Simple word-level diff
    const currentWords = currentSummary.split(/\s+/);
    const previousWords = previousSummary.split(/\s+/);

    if (currentWords.length !== previousWords.length) {
      return {
        type: "modified" as const,
        text: `Length changed: ${previousWords.length} → ${currentWords.length} words`,
      };
    }

    const changedWords = currentWords.filter(
      (word, i) => word !== previousWords[i]
    ).length;
    return {
      type: "modified" as const,
      text: `${changedWords} word${changedWords !== 1 ? "s" : ""} changed`,
    };
  };

  /**
   * Get log entry color based on type
   */
  const getLogColor = (log: SyncLog, index: number) => {
    if (log.notes?.includes("Rolled back")) {
      return "border-yellow-300 bg-yellow-50";
    }
    if (log.synced_by_ai) {
      return "border-green-300 bg-green-50";
    }
    return "border-gray-200 bg-gray-50";
  };

  if (!syncHistory || syncHistory.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <ArrowsClockwise size={48} className="mx-auto mb-2 opacity-50" />
        <p>No sync history available yet.</p>
        <p className="text-sm mt-1">
          Sync this strand to start building history.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {syncHistory
        .slice()
        .reverse()
        .map((log, reverseIndex) => {
          const index = syncHistory.length - 1 - reverseIndex;
          const isExpanded = expandedIndex === index;
          const isRollbackConfirm = rollbackConfirm === index;
          const isHovered = hoveredIndex === index;
          const previousLog = index > 0 ? syncHistory[index - 1] : null;
          
          // Calculate diffs for hover preview
          const tagDiff = previousLog ? getTagDiff(log.tags, previousLog.tags) : null;
          const summaryDiff = previousLog ? getSummaryDiff(log.summary, previousLog.summary) : null;

          return (
            <div
              key={index}
              className={`border rounded-lg overflow-hidden transition-all ${getLogColor(log, index)} ${
                isHovered ? 'shadow-md scale-[1.01]' : 'hover:border-gray-400'
              }`}
              onMouseEnter={() => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {/* Log Header */}
              <div
                className="p-4 cursor-pointer relative"
                onClick={() => handleToggleExpand(index)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <Clock size={16} className="text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">
                        {formatDate(log.timestamp)}
                      </span>
                      {log.synced_by_ai && (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800">
                          ✓ AI Synced
                        </span>
                      )}
                      {log.notes?.includes("Rolled back") && (
                        <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800">
                          <ArrowCounterClockwise size={12} className="mr-1" />
                          Rollback
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600">
                      {isExpanded ? log.summary : truncateSummary(log.summary)}
                    </p>
                    
                    {/* Hover Preview */}
                    {isHovered && previousLog && !isExpanded && (
                      <div className="mt-3 p-3 bg-white rounded border border-gray-300 shadow-sm">
                        <div className="text-xs font-semibold text-gray-700 mb-2">Changes from previous version:</div>
                        
                        {/* Summary Diff */}
                        {summaryDiff && (
                          <div className="mb-2">
                            <span className="text-xs text-gray-600">Summary: </span>
                            <span className={`text-xs ${
                              summaryDiff.type === 'unchanged' ? 'text-gray-500' : 'text-blue-600 font-medium'
                            }`}>
                              {summaryDiff.text}
                            </span>
                          </div>
                        )}
                        
                        {/* Tag Diff */}
                        {tagDiff && (tagDiff.added.length > 0 || tagDiff.removed.length > 0) && (
                          <div className="space-y-1">
                            {tagDiff.added.length > 0 && (
                              <div className="flex items-start gap-1">
                                <span className="text-xs text-green-600 font-medium">+</span>
                                <div className="flex flex-wrap gap-1">
                                  {tagDiff.added.map((tag, i) => (
                                    <span key={i} className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded">
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {tagDiff.removed.length > 0 && (
                              <div className="flex items-start gap-1">
                                <span className="text-xs text-red-600 font-medium">-</span>
                                <div className="flex flex-wrap gap-1">
                                  {tagDiff.removed.map((tag, i) => (
                                    <span key={i} className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded line-through">
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                        
                        {tagDiff && tagDiff.added.length === 0 && tagDiff.removed.length === 0 && (
                          <div className="text-xs text-gray-500">Tags: No changes</div>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    className="ml-2 text-gray-400 hover:text-gray-600 flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleExpand(index);
                    }}
                  >
                    {isExpanded ? "▼" : "▶"}
                  </button>
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="p-4 bg-white border-t border-gray-200">
                  {/* Tags */}
                  <div className="mb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Tag size={16} className="text-gray-500" />
                      <span className="text-sm font-medium text-gray-700">
                        Tags:
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {log.tags.map((tag, tagIndex) => (
                        <span
                          key={tagIndex}
                          className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-md bg-blue-100 text-blue-800"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Notes */}
                  {log.notes && (
                    <div className="mb-3">
                      <span className="text-sm font-medium text-gray-700">
                        Notes:
                      </span>
                      <p className="text-sm text-gray-600 mt-1">{log.notes}</p>
                    </div>
                  )}

                  {/* Rollback Button */}
                  {onRollback && index < syncHistory.length - 1 && (
                    <div className="mt-4 pt-3 border-t border-gray-200">
                      {isRollbackConfirm ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-700">
                            Restore this version?
                          </span>
                          <button
                            onClick={() => handleConfirmRollback(log)}
                            className="px-3 py-1 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700"
                          >
                            Confirm
                          </button>
                          <button
                            onClick={handleCancelRollback}
                            className="px-3 py-1 text-sm font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleRollbackClick(index)}
                          className="px-3 py-1 text-sm font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100"
                        >
                          Restore to this version
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
};

export default SyncLogViewer;
