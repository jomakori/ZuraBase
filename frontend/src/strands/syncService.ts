import { Strand } from "./types";
import { StrandsApi } from "./api";
import { log as logger } from "../utils/clientLogger";

const MODULE = "SyncService";

export interface SyncResult {
  success: boolean;
  strandId: string;
  strandTitle?: string;
  error?: string;
}

export interface AIStep {
  id: string;
  label: string;
  status: "pending" | "active" | "completed" | "error";
  timestamp: Date;
  details?: string;
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
  thinkingMessage?: string; // Current AI thinking/processing message for the current item
  strandProgress?: {
    strandId: string;
    strandTitle: string;
    status: "pending" | "active" | "completed" | "error" | "cancelled";
    message?: string;
    aiSteps?: AIStep[]; // AI steps for this specific strand
    thinkingMessage?: string; // Thinking message for this specific strand
  }[]; // Progress for individual strands in multi-sync
}

export interface SyncOptions {
  onProgress?: (progress: SyncProgress) => void;
  onComplete?: (results: SyncResult[]) => void;
  onError?: (error: string) => void;
  signal?: AbortSignal;
}

/**
 * Unified Sync Service
 * Consolidates all sync operations into a single, reusable service
 */
export class SyncService {
  private abortController: AbortController | null = null;

  /**
   * Poll for a single strand's sync completion
   */
  private async pollStrandSyncCompletion(
    strandId: string,
    originalStrand: Strand,
    maxPollingDurationSeconds: number = 300, // 5 minutes max
    initialDelayMs: number = 1000, // 1 second
    maxDelayMs: number = 60000, // 1 minute
    signal?: AbortSignal,
    aiSteps?: AIStep[],
    onProgress?: (progress: SyncProgress) => void
  ): Promise<{ completed: boolean; updatedStrand?: Strand; error?: string }> {
    let attempts = 0;
    let totalElapsedTime = 0;
    let consecutiveNetworkErrors = 0;
    let consecutiveAIFailures = 0;
    const MAX_CONSECUTIVE_NETWORK_ERRORS = 5; // Increased threshold for more resilience
    const MAX_CONSECUTIVE_AI_FAILURES = 3; // Allow a few retries for AI processing failures
    const MAX_POLLING_DURATION_SECONDS = 300; // 5 minutes max

    while (totalElapsedTime < maxPollingDurationSeconds * 1000) {
      if (signal?.aborted) {
        logger.warn(MODULE, `Polling for strand ${strandId} aborted by user.`);
        return { completed: false, error: "Sync cancelled by user" };
      }

      attempts++;
      const currentDelay = Math.min(
        maxDelayMs,
        initialDelayMs * Math.pow(2, attempts - 1) + Math.random() * 500 // Add jitter
      );

      logger.debug(
        MODULE,
        `Polling for strand ${strandId} sync completion (attempt ${attempts}, delay ${currentDelay}ms, elapsed ${
          totalElapsedTime / 1000
        }s)`
      );

      await new Promise((resolve) => setTimeout(resolve, currentDelay));
      totalElapsedTime += currentDelay;

      // No longer inferring AI step progress based on polling time,
      // as backend AI analysis is an atomic operation.
      // The AI steps will be updated only on success or explicit error.

      try {
        const response = await StrandsApi.getStrand(strandId);
        const updatedStrand = response.strand;

        if (!updatedStrand) {
          logger.warn(
            MODULE,
            `Polling response for strand ${strandId} returned no strand data.`
          );
          consecutiveNetworkErrors++;
          if (consecutiveNetworkErrors >= MAX_CONSECUTIVE_NETWORK_ERRORS) {
            logger.error(
              MODULE,
              `Circuit breaker tripped for strand ${strandId}: too many consecutive null strand responses.`
            );
            return {
              completed: false,
              error: "No strand data returned repeatedly.",
            };
          }
          continue; // Continue polling, but increment error count
        }

        // Reset consecutive network errors on success
        consecutiveNetworkErrors = 0;

        // Check AIStatus for failure detection
        if (updatedStrand.ai_status === "failed") {
          consecutiveAIFailures++;
          logger.warn(
            MODULE,
            `Strand ${strandId} AI processing failed (attempt ${consecutiveAIFailures}/${MAX_CONSECUTIVE_AI_FAILURES}). Reason: ${
              updatedStrand.ai_failure_reason || "Unknown"
            }`
          );

          if (consecutiveAIFailures >= MAX_CONSECUTIVE_AI_FAILURES) {
            logger.error(
              MODULE,
              `Strand ${strandId} AI processing failed persistently after ${MAX_CONSECUTIVE_AI_FAILURES} attempts.`
            );
            return {
              completed: false,
              error: `AI processing failed on backend: ${
                updatedStrand.ai_failure_reason || "Please check backend logs."
              }`,
            };
          }
          // If not exceeding max retries, continue polling
          continue;
        } else if (updatedStrand.ai_status === "completed") {
          // Reset AI failure counter if it eventually succeeds
          consecutiveAIFailures = 0;
        }

        // Null-safe sync history comparison
        const originalHistoryLength = originalStrand.sync_history?.length || 0;
        const updatedHistoryLength = updatedStrand.sync_history?.length || 0;

        const syncCompleted = updatedStrand.synced_with_ai;
        const hasMeaningfulChanges =
          updatedHistoryLength > originalHistoryLength ||
          updatedStrand.summary !== originalStrand.summary ||
          JSON.stringify(updatedStrand.tags) !==
            JSON.stringify(originalStrand.tags);

        if (syncCompleted && hasMeaningfulChanges) {
          logger.debug(
            MODULE,
            `Strand ${strandId} sync completed with meaningful changes.`
          );
          return { completed: true, updatedStrand };
        }

        // If synced_with_ai is true but no meaningful changes detected,
        // still consider it completed after a few attempts to avoid infinite polling
        if (syncCompleted && attempts > MAX_CONSECUTIVE_NETWORK_ERRORS) {
          // Use network errors as a general threshold for "stuck" polling
          logger.debug(
            MODULE,
            `Strand ${strandId} marked as synced but no meaningful changes detected, considering sync complete after ${attempts} attempts.`
          );
          return { completed: true, updatedStrand };
        }
      } catch (err) {
        logger.error(
          MODULE,
          `Error polling for sync status for strand ${strandId}: ${
            err instanceof Error ? err.message : String(err)
          }`,
          err as Error
        );
        consecutiveNetworkErrors++;
        if (consecutiveNetworkErrors >= MAX_CONSECUTIVE_NETWORK_ERRORS) {
          logger.error(
            MODULE,
            `Circuit breaker tripped for strand ${strandId}: too many consecutive network errors.`
          );
          return {
            completed: false,
            error: `Persistent network error during sync: ${
              err instanceof Error ? err.message : String(err)
            }`,
          };
        }
        // Continue polling despite network errors, but with backoff
      }
    }

    logger.warn(
      MODULE,
      `Strand ${strandId} sync polling timed out after ${MAX_POLLING_DURATION_SECONDS} seconds and ${attempts} attempts.`
    );
    return {
      completed: false,
      error:
        "Sync timed out. The AI may still be processing the strand. Please check back later.",
    };
  }

  /**
   * Get a human-readable title for a strand
   */
  private getStrandTitle(strand: Strand): string {
    return strand.summary || strand.content.substring(0, 50) + "...";
  }

  /**
   * Sync a single strand with AI
   */
  async syncSingle(
    strand: Strand,
    options: SyncOptions = {}
  ): Promise<SyncResult> {
    const { onProgress, signal } = options;

    // Initialize AI steps at function scope
    const aiSteps: AIStep[] = [
      {
        id: "step-1",
        label: "Preparing content",
        status: "active",
        timestamp: new Date(),
        details: "Analyzing strand content and structure",
      },
      {
        id: "step-2",
        label: "Connecting to AI service",
        status: "pending",
        timestamp: new Date(),
      },
      {
        id: "step-3",
        label: "AI Processing",
        status: "pending",
        timestamp: new Date(),
        details: "Analyzing content, generating tags, and creating summary",
      },
      {
        id: "step-4",
        label: "Saving results",
        status: "pending",
        timestamp: new Date(),
      },
    ];

    try {
      // Notify start
      logger.debug(MODULE, `Starting sync for single strand ${strand.id}`);

      if (onProgress) {
        onProgress({
          total: 1,
          completed: 0,
          failed: 0,
          currentItem: this.getStrandTitle(strand),
          status: "syncing",
          message: "Preparing strand for AI processing...",
          currentOperation: "Processing input",
          aiSteps: [...aiSteps],
          thinkingMessage: "Analyzing your content...",
        });
      }

      // Step 1: Complete preparation
      await new Promise((resolve) => setTimeout(resolve, 500));
      aiSteps[0].status = "completed";
      aiSteps[1].status = "active";

      if (onProgress) {
        onProgress({
          total: 1,
          completed: 0,
          failed: 0,
          currentItem: this.getStrandTitle(strand),
          status: "syncing",
          currentOperation: "Connecting to AI",
          aiSteps: [...aiSteps],
          thinkingMessage: "Establishing connection with AI service...",
        });
      }

      // Initiate sync
      logger.debug(MODULE, `Calling StrandsApi.syncStrand for ${strand.id}`);
      await StrandsApi.syncStrand(strand.id);
      logger.debug(
        MODULE,
        `StrandsApi.syncStrand call returned for ${strand.id}`
      );

      // Step 2: Connected to AI
      aiSteps[1].status = "completed";
      aiSteps[2].status = "active";

      if (onProgress) {
        onProgress({
          total: 1,
          completed: 0,
          failed: 0,
          currentItem: this.getStrandTitle(strand),
          status: "syncing",
          message: "Syncing with AI...",
          currentOperation: "Syncing strand with AI",
          aiSteps: [...aiSteps],
          thinkingMessage:
            "AI is analyzing your content and extracting key insights...",
        });
      }

      if (signal?.aborted) {
        return {
          success: false,
          strandId: strand.id,
          strandTitle: this.getStrandTitle(strand),
          error: "Sync cancelled by user",
        };
      }

      // Poll for completion with intelligent timeout management
      const result = await this.pollStrandSyncCompletion(
        strand.id,
        strand,
        300, // 5 minutes max duration
        1000, // 1 second initial delay
        60000, // 1 minute max delay
        signal,
        aiSteps,
        onProgress
      );

      if (result.completed) {
        // Mark remaining steps as completed
        aiSteps[2].status = "completed";
        aiSteps[3].status = "completed";

        if (onProgress) {
          onProgress({
            total: 1,
            completed: 1,
            failed: 0,
            status: "completed",
            message: "Strand synced successfully!",
            currentOperation: "Applying changes",
            aiSteps: [...aiSteps],
          });
        }
        logger.debug(MODULE, `Single strand ${strand.id} synced successfully`);
        return {
          success: true,
          strandId: strand.id,
          strandTitle: this.getStrandTitle(strand),
        };
      } else {
        const error =
          result.error ||
          (signal?.aborted
            ? "Sync cancelled by user"
            : "Sync timed out. The AI may still be processing the strand. Please check back later.");

        // Mark all active/pending AI steps as error
        aiSteps.forEach((step) => {
          if (step.status === "active" || step.status === "pending") {
            step.status = "error";
            step.details = error;
          }
        });

        if (onProgress) {
          onProgress({
            total: 1,
            completed: 0,
            failed: 1,
            status: "error",
            message: error,
            currentOperation: "Sync failed",
            aiSteps: [...aiSteps],
          });
        }
        logger.error(
          MODULE,
          `Single strand ${strand.id} sync failed: ${error}`
        );
        return {
          success: false,
          strandId: strand.id,
          strandTitle: this.getStrandTitle(strand),
          error,
        };
      }
    } catch (err) {
      const error = this.formatError(err);
      logger.error(
        MODULE,
        `Unexpected error during single strand sync for ${strand.id}`,
        err as Error
      );

      // Mark all active/pending AI steps as error
      aiSteps.forEach((step: AIStep) => {
        if (step.status === "active" || step.status === "pending") {
          step.status = "error";
          step.details = error;
        }
      });

      if (onProgress) {
        onProgress({
          total: 1,
          completed: 0,
          failed: 1,
          status: "error",
          message: error,
          currentOperation: "Sync failed",
          aiSteps: [...aiSteps],
        });
      }

      return {
        success: false,
        strandId: strand.id,
        strandTitle: this.getStrandTitle(strand),
        error,
      };
    }
  }

  /**
   * Sync multiple strands with progress tracking
   */
  async syncMultiple(
    strands: Strand[],
    options: SyncOptions = {}
  ): Promise<SyncResult[]> {
    const { onProgress, onComplete, onError } = options;
    const results: SyncResult[] = [];
    let completed = 0;
    let failed = 0;

    // Initialize strandProgress for all strands
    const strandProgress: {
      strandId: string;
      strandTitle: string;
      status: "pending" | "active" | "completed" | "error" | "cancelled";
      message?: string;
      aiSteps?: AIStep[];
      thinkingMessage?: string;
    }[] = strands.map((s) => ({
      strandId: s.id,
      strandTitle: this.getStrandTitle(s),
      status: "pending",
      message: "Waiting to start...",
    }));

    // Create abort controller for cancellation support
    this.abortController = new AbortController();
    const signal = options.signal || this.abortController.signal;

    logger.debug(
      MODULE,
      `Starting multi-strand sync for ${strands.length} strands`
    );
    try {
      for (const strand of strands) {
        if (signal.aborted) {
          logger.warn(MODULE, "Multi-strand sync aborted by user");
          // Add cancelled results for remaining strands
          for (let i = completed; i < strands.length; i++) {
            results.push({
              success: false,
              strandId: strands[i].id,
              strandTitle: this.getStrandTitle(strands[i]),
              error: "Sync cancelled by user",
            });
          }

          if (onProgress) {
            onProgress({
              total: strands.length,
              completed,
              failed: strands.length - completed,
              status: "cancelled",
              message: "Sync cancelled by user",
              currentOperation: "Cancelled",
            });
          }
          break;
        }

        // Notify progress - starting current strand
        // Update current strand's status to active
        const currentStrandIndex = strands.findIndex((s) => s.id === strand.id);
        if (currentStrandIndex !== -1) {
          strandProgress[currentStrandIndex].status = "active";
          strandProgress[currentStrandIndex].message = "Processing...";
        }

        if (onProgress) {
          onProgress({
            total: strands.length,
            completed,
            failed,
            currentItem: this.getStrandTitle(strand),
            status: "syncing",
            message: `Processing strand ${completed + 1} of ${
              strands.length
            }...`,
            currentOperation: "Processing input",
            strandProgress: [...strandProgress], // Pass a copy to ensure immutability
          });
        }

        // Sync the strand
        logger.debug(
          MODULE,
          `Initiating sync for strand ${strand.id} in multi-sync operation`
        );
        const result = await this.syncSingle(strand, {
          signal,
          onProgress: (p) => {
            // Update the specific strand's progress with AI steps and thinking messages
            if (currentStrandIndex !== -1) {
              strandProgress[currentStrandIndex] = {
                ...strandProgress[currentStrandIndex],
                status: p.status === "syncing" ? ("active" as const) : p.status,
                message: p.message,
                aiSteps: p.aiSteps,
                thinkingMessage: p.thinkingMessage,
              };
              onProgress?.({
                total: strands.length,
                completed,
                failed,
                currentItem: this.getStrandTitle(strand),
                status: "syncing",
                message: `Processing strand ${completed + failed + 1} of ${
                  strands.length
                }...`,
                currentOperation: p.currentOperation,
                aiSteps: p.aiSteps,
                thinkingMessage: p.thinkingMessage,
                strandProgress: [...strandProgress],
              });
            }
          },
        });
        results.push(result);
        logger.debug(MODULE, `Sync result for strand ${strand.id}`, { result });

        if (result.success) {
          completed++;
        } else {
          failed++;
        }

        // Update current strand's status based on result
        if (currentStrandIndex !== -1) {
          strandProgress[currentStrandIndex].status = result.success
            ? "completed"
            : "error";
          strandProgress[currentStrandIndex].message = result.success
            ? "Completed"
            : result.error || "Failed";
          strandProgress[currentStrandIndex].aiSteps = undefined; // Clear AI steps after completion/failure
          strandProgress[currentStrandIndex].thinkingMessage = undefined; // Clear thinking message
        }

        // Notify progress after completion
        if (onProgress) {
          onProgress({
            total: strands.length,
            completed,
            failed,
            status: "syncing",
            message: `Processed ${completed + failed} of ${strands.length}`,
            currentOperation: result.success ? "Completed" : "Failed",
            strandProgress: [...strandProgress],
          });
        }
      }
      logger.debug(
        MODULE,
        `Multi-strand sync loop finished. Completed: ${completed}, Failed: ${failed}`
      );

      // Final status
      const finalStatus = signal.aborted
        ? "cancelled"
        : failed > 0
        ? "error"
        : "completed";

      const finalMessage = this.getSyncStatusMessage(
        completed,
        strands.length,
        failed,
        signal.aborted
      );

      if (onProgress) {
        onProgress({
          total: strands.length,
          completed,
          failed,
          status: finalStatus,
          message: finalMessage,
          currentOperation:
            finalStatus === "completed"
              ? "All strands synced"
              : finalStatus === "error"
              ? "Sync completed with errors"
              : "Sync cancelled",
          strandProgress: [...strandProgress],
        });
      }

      // Notify completion
      if (onComplete) {
        onComplete(results);
      }
      logger.debug(
        MODULE,
        `Multi-strand sync operation completed with status: ${finalStatus}`,
        { results }
      );

      return results;
    } catch (err) {
      const error = this.formatError(err);

      if (onError) {
        onError(error);
      }

      if (onProgress) {
        onProgress({
          total: strands.length,
          completed,
          failed: strands.length - completed,
          status: "error",
          message: error,
          currentOperation: "Sync failed",
          strandProgress: [...strandProgress],
        });
      }
      logger.error(MODULE, "Error during multi-strand sync", err as Error);

      throw err;
    } finally {
      this.abortController = null;
    }
  }

  /**
   * Cancel ongoing sync operation
   */
  cancel(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  /**
   * Get a human-readable sync status message
   */
  private getSyncStatusMessage(
    completed: number,
    total: number,
    failed: number = 0,
    cancelled: boolean = false
  ): string {
    if (cancelled) {
      return `Sync cancelled. ${completed} of ${total} strand${
        total !== 1 ? "s" : ""
      } processed.`;
    }

    if (completed === 0 && !cancelled && total > 0) {
      return "Preparing to sync strands...";
    }

    if (completed < total && !cancelled) {
      return `Syncing strands... ${completed} of ${total} processed`;
    }

    if (failed > 0) {
      return `Sync completed with ${failed} error${failed !== 1 ? "s" : ""}. ${
        completed - failed
      } strand${completed - failed !== 1 ? "s" : ""} synced successfully.`;
    }

    return `All ${total} strand${total !== 1 ? "s" : ""} synced successfully!`;
  }

  /**
   * Format error message for display
   */
  private formatError(error: unknown): string {
    if (error instanceof Error) {
      if (error.message.includes("Failed to fetch")) {
        return "Unable to connect to server. Please check your connection.";
      }
      if (error.message.includes("401")) {
        return "Session expired. Please log in again.";
      }
      if (error.message.includes("503")) {
        return "AI service is currently unavailable. Please try again later.";
      }
      return error.message;
    }
    return "An unexpected error occurred during sync.";
  }
}

// Export singleton instance
export const syncService = new SyncService();
