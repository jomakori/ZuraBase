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
  aiSteps?: AIStep[]; // Detailed operation steps for the current item
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
        logger.warn(`Polling for strand ${strandId} aborted by user.`, { module: MODULE });
        return { completed: false, error: "Sync cancelled by user" };
      }

      attempts++;
      const currentDelay = Math.min(
        maxDelayMs,
        initialDelayMs * Math.pow(2, attempts - 1) + Math.random() * 500 // Add jitter
      );

      logger.debug(
        `Polling for strand ${strandId} sync completion (attempt ${attempts}, delay ${currentDelay}ms, elapsed ${
          totalElapsedTime / 1000
        }s)`,
        { module: MODULE, attempts, delay: currentDelay, elapsed: totalElapsedTime / 1000 }
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
            `Polling response for strand ${strandId} returned no strand data.`,
            { module: MODULE }
          );
          consecutiveNetworkErrors++;
          if (consecutiveNetworkErrors >= MAX_CONSECUTIVE_NETWORK_ERRORS) {
            logger.error(
              `Circuit breaker tripped for strand ${strandId}: too many consecutive null strand responses.`,
              { module: MODULE }
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
            `Strand ${strandId} AI processing failed (attempt ${consecutiveAIFailures}/${MAX_CONSECUTIVE_AI_FAILURES}). Reason: ${
              updatedStrand.ai_failure_reason || "Unknown"
            }`,
            { module: MODULE }
          );

          if (consecutiveAIFailures >= MAX_CONSECUTIVE_AI_FAILURES) {
            logger.error(
              `Strand ${strandId} AI processing failed persistently after ${MAX_CONSECUTIVE_AI_FAILURES} attempts.`,
              { module: MODULE }
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

        // Get the latest sync log entry from the updated strand
        const latestSyncLog = updatedStrand.sync_history?.[updatedHistoryLength - 1];
        let detectedUrlCount: number | undefined;
        let extractedUrlCount: number | undefined;
        let unsupportedUrlCount: number | undefined;
        let urlProcessingMessage: string | undefined;

        if (latestSyncLog?.notes) {
          // Example: "Automatic AI enrichment (3 URL(s) unsupported by Firecrawl, 5 URL(s) extracted)"
          const unsupportedMatch = latestSyncLog.notes.match(/(\d+) URL\(s\) unsupported by Firecrawl/);
          const extractedMatch = latestSyncLog.notes.match(/(\d+) URL\(s\) extracted/);
          const detectedMatch = latestSyncLog.notes.match(/Detected (\d+) URLs/);

          if (unsupportedMatch) {
            unsupportedUrlCount = parseInt(unsupportedMatch[1]);
          }
          if (extractedMatch) {
            extractedUrlCount = parseInt(extractedMatch[1]);
          }
          // If we have either unsupported or extracted, we detected some URLs
          if (unsupportedUrlCount !== undefined || extractedUrlCount !== undefined) {
            detectedUrlCount = (unsupportedUrlCount || 0) + (extractedUrlCount || 0);
          }
          // For messages, prioritize unsupported if present, otherwise extracted
          if (unsupportedUrlCount !== undefined && unsupportedUrlCount > 0) {
            urlProcessingMessage = `${unsupportedUrlCount} URL(s) unsupported`;
          } else if (extractedUrlCount !== undefined && extractedUrlCount > 0) {
            urlProcessingMessage = `${extractedUrlCount} URL(s) extracted`;
          }
          if (detectedMatch) {
            detectedUrlCount = parseInt(detectedMatch[1]);
            urlProcessingMessage = `Processing ${detectedUrlCount} URLs...`;
          }
        }

        const syncCompleted = updatedStrand.synced_with_ai;
        const hasMeaningfulChanges =
          updatedHistoryLength > originalHistoryLength ||
          updatedStrand.summary !== originalStrand.summary ||
          JSON.stringify(updatedStrand.tags) !==
            JSON.stringify(originalStrand.tags);

        if (syncCompleted && hasMeaningfulChanges) {
          logger.debug(
            `Strand ${strandId} sync completed with meaningful changes.`,
            { module: MODULE }
          );
          return { completed: true, updatedStrand };
        }

        // If synced_with_ai is true but no meaningful changes detected,
        // still consider it completed after a few attempts to avoid infinite polling
        if (syncCompleted && attempts > MAX_CONSECUTIVE_NETWORK_ERRORS) {
          // Use network errors as a general threshold for "stuck" polling
          logger.debug(
            `Strand ${strandId} marked as synced but no meaningful changes detected, considering sync complete after ${attempts} attempts.`,
            { module: MODULE }
          );
          return { completed: true, updatedStrand };
        }

        // Report progress back with URL processing info
        if (onProgress) {
          onProgress({
            total: 1,
            completed: 0,
            failed: 0,
            currentItem: this.getStrandTitle(updatedStrand),
            status: "syncing",
            message: `AI processing strand: ${this.getStrandTitle(updatedStrand)}`,
            currentOperation: "AI Processing",
            aiSteps: aiSteps, // Pass the current AI steps
            processingMessage: "Analyzing content and extracting key insights...",
            detectedUrlCount,
            extractedUrlCount,
            unsupportedUrlCount,
            urlProcessingMessage,
          });
        }

      } catch (err) {
        logger.error(
          `Error polling for sync status for strand ${strandId}: ${
            err instanceof Error ? err.message : String(err)
          }`,
          { module: MODULE, error: err }
        );
        consecutiveNetworkErrors++;
        if (consecutiveNetworkErrors >= MAX_CONSECUTIVE_NETWORK_ERRORS) {
          logger.error(
            `Circuit breaker tripped for strand ${strandId}: too many consecutive network errors.`,
            { module: MODULE }
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
      `Strand ${strandId} sync polling timed out after ${MAX_POLLING_DURATION_SECONDS} seconds and ${attempts} attempts.`,
      { module: MODULE }
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

    // Initial progress update for URL processing detection
    // This assumes URL detection happens very early in the backend.
    // We'll update these counts as more detailed info comes from polling.
    let initialDetectedUrlCount: number | undefined;
    if (strand.content) {
      const detectedUrls = new LinkProcessor().DetectURLs(strand.content); // Use a temporary LinkProcessor for initial detection
      if (detectedUrls.length > 0) {
        initialDetectedUrlCount = detectedUrls.length;
      }
    }

    try {
      // Notify start
      logger.debug(`Starting sync for single strand ${strand.id}`, { module: MODULE });

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
          processingMessage: "Analyzing your content...",
          detectedUrlCount: initialDetectedUrlCount,
          urlProcessingMessage: initialDetectedUrlCount ? `Detected ${initialDetectedUrlCount} URL(s)` : undefined,
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
          processingMessage: "Establishing connection with AI service...",
          detectedUrlCount: initialDetectedUrlCount,
          urlProcessingMessage: initialDetectedUrlCount ? `Detected ${initialDetectedUrlCount} URL(s)` : undefined,
        });
      }

      // Initiate sync
      logger.debug(`Calling StrandsApi.syncStrand for ${strand.id}`, { module: MODULE });
      await StrandsApi.syncStrand(strand.id);
      logger.debug(
        `StrandsApi.syncStrand call returned for ${strand.id}`,
        { module: MODULE }
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
          processingMessage:
            "AI is analyzing your content and extracting key insights...",
          detectedUrlCount: initialDetectedUrlCount,
          urlProcessingMessage: initialDetectedUrlCount ? `Detected ${initialDetectedUrlCount} URL(s)` : undefined,
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

        // Re-fetch the updated strand to get the latest sync log for final URL counts
        const finalStrandResponse = await StrandsApi.getStrand(strand.id);
        const finalStrand = finalStrandResponse.strand;
        let finalDetectedUrlCount: number | undefined;
        let finalExtractedUrlCount: number | undefined;
        let finalUnsupportedUrlCount: number | undefined;
        let finalUrlProcessingMessage: string | undefined;

        if (finalStrand?.sync_history) {
          const latestFinalSyncLog = finalStrand.sync_history[finalStrand.sync_history.length - 1];
          if (latestFinalSyncLog?.notes) {
            const unsupportedMatch = latestFinalSyncLog.notes.match(/(\d+) URL\(s\) unsupported by Firecrawl/);
            const extractedMatch = latestFinalSyncLog.notes.match(/(\d+) URL\(s\) extracted/);
            const detectedMatch = latestFinalSyncLog.notes.match(/Detected (\d+) URLs/);

            if (unsupportedMatch) {
              finalUnsupportedUrlCount = parseInt(unsupportedMatch[1]);
            }
            if (extractedMatch) {
              finalExtractedUrlCount = parseInt(extractedMatch[1]);
            }
            if (unsupportedMatch || extractedMatch) {
              finalDetectedUrlCount = (finalUnsupportedUrlCount || 0) + (finalExtractedUrlCount || 0);
            }
            if (finalUnsupportedUrlCount !== undefined && finalUnsupportedUrlCount > 0) {
              finalUrlProcessingMessage = `${finalUnsupportedUrlCount} URL(s) unsupported`;
            } else if (finalExtractedUrlCount !== undefined && finalExtractedUrlCount > 0) {
              finalUrlProcessingMessage = `${finalExtractedUrlCount} URL(s) extracted`;
            }
            if (detectedMatch) {
              finalDetectedUrlCount = parseInt(detectedMatch[1]);
              finalUrlProcessingMessage = `Detected ${finalDetectedUrlCount} URLs`;
            }
          }
        }

        if (onProgress) {
          onProgress({
            total: 1,
            completed: 1,
            failed: 0,
            status: "completed",
            message: "Strand synced successfully!",
            currentOperation: "Applying changes",
            aiSteps: [...aiSteps],
            detectedUrlCount: finalDetectedUrlCount,
            extractedUrlCount: finalExtractedUrlCount,
            unsupportedUrlCount: finalUnsupportedUrlCount,
            urlProcessingMessage: finalUrlProcessingMessage,
          });
        }
        logger.debug(`Single strand ${strand.id} synced successfully`, { module: MODULE });
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
            // Include any available URL processing info on error
            detectedUrlCount: initialDetectedUrlCount, // Use initial detected count on error
            urlProcessingMessage: initialDetectedUrlCount ? `Detected ${initialDetectedUrlCount} URL(s)` : undefined,
          });
        }
        logger.error(
          `Single strand ${strand.id} sync failed: ${error}`,
          { module: MODULE }
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
        `Unexpected error during single strand sync for ${strand.id}`,
        { module: MODULE, error: err }
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
          // Include any available URL processing info on error
          detectedUrlCount: initialDetectedUrlCount, // Use initial detected count on error
          urlProcessingMessage: initialDetectedUrlCount ? `Detected ${initialDetectedUrlCount} URL(s)` : undefined,
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
      processingMessage?: string;
      detectedUrlCount?: number;
      extractedUrlCount?: number;
      unsupportedUrlCount?: number;
      urlProcessingMessage?: string;
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
      `Starting multi-strand sync for ${strands.length} strands`,
      { module: MODULE }
    );
    try {
      for (const strand of strands) {
        if (signal.aborted) {
          logger.warn("Multi-strand sync aborted by user", { module: MODULE });
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

        // Initial URL detection for multi-sync strands
        let initialDetectedUrlCountForMulti: number | undefined;
        // Reusing the LinkProcessor from the SyncService if available (e.g., if Firecrawl API key is set)
        // Otherwise, creating a temporary instance for simple URL detection.
        const tempLinkProcessor = new LinkProcessor(); // Assuming LinkProcessor can be instantiated without backend dependencies for just DetectURLs
        if (strand.content) {
          const detectedUrls = tempLinkProcessor.DetectURLs(strand.content);
          if (detectedUrls.length > 0) {
            initialDetectedUrlCountForMulti = detectedUrls.length;
            strandProgress[currentStrandIndex].detectedUrlCount = initialDetectedUrlCountForMulti;
            strandProgress[currentStrandIndex].urlProcessingMessage = `Detected ${initialDetectedUrlCountForMulti} URL(s)`;
          }
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
            // Also pass overall URL counts if applicable (though this is for single strand mostly)
            detectedUrlCount: initialDetectedUrlCountForMulti,
            urlProcessingMessage: initialDetectedUrlCountForMulti ? `Detected ${initialDetectedUrlCountForMulti} URL(s)` : undefined,
          });
        }

        // Sync the strand
        logger.debug(
          `Initiating sync for strand ${strand.id} in multi-sync operation`,
          { module: MODULE }
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
                processingMessage: p.processingMessage,
                // Pass URL processing info from single sync progress
                detectedUrlCount: p.detectedUrlCount,
                extractedUrlCount: p.extractedUrlCount,
                unsupportedUrlCount: p.unsupportedUrlCount,
                urlProcessingMessage: p.urlProcessingMessage,
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
                processingMessage: p.processingMessage,
                strandProgress: [...strandProgress],
                // Aggregate URL counts if needed for overall progress, or just pass current strand's
                detectedUrlCount: p.detectedUrlCount,
                extractedUrlCount: p.extractedUrlCount,
                unsupportedUrlCount: p.unsupportedUrlCount,
                urlProcessingMessage: p.urlProcessingMessage,
              });
            }
          },
        });
        results.push(result);
        logger.debug(`Sync result for strand ${strand.id}`, { module: MODULE, result });

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
          strandProgress[currentStrandIndex].processingMessage = undefined; // Clear thinking message
          // Clear URL processing info for completed strand, or keep final counts if desired
          // For now, let's clear them as it's not the active strand anymore
          strandProgress[currentStrandIndex].detectedUrlCount = undefined;
          strandProgress[currentStrandIndex].extractedUrlCount = undefined;
          strandProgress[currentStrandIndex].unsupportedUrlCount = undefined;
          strandProgress[currentStrandIndex].urlProcessingMessage = undefined;
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
        `Multi-strand sync loop finished. Completed: ${completed}, Failed: ${failed}`,
        { module: MODULE }
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
        `Multi-strand sync operation completed with status: ${finalStatus}`,
        { module: MODULE, results }
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
      logger.error("Error during multi-strand sync", { module: MODULE, error: err });

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

// Temporary LinkProcessor for initial URL detection in frontend
// This is a simplified version for client-side detection only and does not perform actual network requests.
class LinkProcessor {
  private urlPattern = /https?:\/\/[^\s\)]+/g;

  DetectURLs(content: string): string[] {
    const matches = [...content.matchAll(this.urlPattern)];
    const urls = matches.map(match => match[0].replace(/[.,;:!?)]+$/, '')); // Trim trailing punctuation
    return [...new Set(urls)]; // Return unique URLs
  }
}
