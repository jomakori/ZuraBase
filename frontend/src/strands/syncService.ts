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
  aiSteps?: AIStep[];
  thinkingMessage?: string;
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
    maxAttempts: number = 40,
    signal?: AbortSignal,
    aiSteps?: AIStep[],
    onProgress?: (progress: SyncProgress) => void
  ): Promise<{ completed: boolean; updatedStrand?: Strand }> {
    let attempts = 0;

    while (attempts < maxAttempts) {
      if (signal?.aborted) {
        return { completed: false };
      }

      attempts++;
      logger.debug(
        MODULE,
        `Polling for strand ${strandId} sync completion (attempt ${attempts}/${maxAttempts})`
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Update AI steps based on polling progress
      if (aiSteps && onProgress && attempts > 0) {
        const progressPercent = (attempts / maxAttempts) * 100;

        if (progressPercent > 20 && aiSteps[2].status !== "completed") {
          aiSteps[2].status = "completed";
          aiSteps[3].status = "active";
          onProgress({
            total: 1,
            completed: 0,
            failed: 0,
            status: "syncing",
            aiSteps: [...aiSteps],
            thinkingMessage: "Generating relevant tags for your content...",
          });
        }

        if (progressPercent > 40 && aiSteps[3].status !== "completed") {
          aiSteps[3].status = "completed";
          aiSteps[4].status = "active";
          onProgress({
            total: 1,
            completed: 0,
            failed: 0,
            status: "syncing",
            aiSteps: [...aiSteps],
            thinkingMessage: "Creating a concise summary...",
          });
        }

        if (progressPercent > 60 && aiSteps[4].status !== "completed") {
          aiSteps[4].status = "completed";
          aiSteps[5].status = "active";
          onProgress({
            total: 1,
            completed: 0,
            failed: 0,
            status: "syncing",
            aiSteps: [...aiSteps],
            thinkingMessage: "Finding related strands in your collection...",
          });
        }
      }

      try {
        const response = await StrandsApi.getStrand(strandId);
        const updatedStrand = response.strand;
        logger.debug(MODULE, `Polling response for strand ${strandId}`, {
          updatedStrand,
        });

        if (!updatedStrand) {
          continue;
        }

        // Check if sync completed
        const syncCompleted =
          updatedStrand.synced_with_ai &&
          (updatedStrand.sync_history.length >
            originalStrand.sync_history.length ||
            updatedStrand.summary !== originalStrand.summary ||
            JSON.stringify(updatedStrand.tags) !==
              JSON.stringify(originalStrand.tags));

        if (syncCompleted) {
          return { completed: true, updatedStrand };
        }
      } catch (err) {
        logger.error(
          MODULE,
          `Error polling for sync status for strand ${strandId}`,
          err as Error
        );
        // Continue polling despite errors
      }
    }
    logger.warn(
      MODULE,
      `Strand ${strandId} sync polling timed out after ${maxAttempts} attempts`
    );

    return { completed: false };
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

    try {
      // Notify start
      logger.debug(MODULE, `Starting sync for single strand ${strand.id}`);
      // Initialize AI steps
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
          label: "Extracting insights",
          status: "pending",
          timestamp: new Date(),
        },
        {
          id: "step-4",
          label: "Generating tags",
          status: "pending",
          timestamp: new Date(),
        },
        {
          id: "step-5",
          label: "Creating summary",
          status: "pending",
          timestamp: new Date(),
        },
        {
          id: "step-6",
          label: "Finding related strands",
          status: "pending",
          timestamp: new Date(),
        },
        {
          id: "step-7",
          label: "Saving results",
          status: "pending",
          timestamp: new Date(),
        },
      ];

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

      // Poll for completion (40 attempts × 1 second = 40 seconds max wait)
      const result = await this.pollStrandSyncCompletion(
        strand.id,
        strand,
        40,
        signal,
        aiSteps,
        onProgress
      );

      if (result.completed) {
        // Mark remaining steps as completed
        aiSteps[5].status = "completed";
        aiSteps[6].status = "completed";

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
        const error = signal?.aborted
          ? "Sync cancelled by user"
          : "Sync timed out. The AI may still be processing the strand. Please check back later.";

        if (onProgress) {
          onProgress({
            total: 1,
            completed: 0,
            failed: 1,
            status: "error",
            message: error,
            currentOperation: "Sync failed",
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

      if (onProgress) {
        onProgress({
          total: 1,
          completed: 0,
          failed: 1,
          status: "error",
          message: error,
          currentOperation: "Sync failed",
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
          });
        }

        // Sync the strand
        logger.debug(
          MODULE,
          `Initiating sync for strand ${strand.id} in multi-sync operation`
        );
        const result = await this.syncSingle(strand, { signal });
        results.push(result);
        logger.debug(MODULE, `Sync result for strand ${strand.id}`, { result });

        if (result.success) {
          completed++;
        } else {
          failed++;
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
