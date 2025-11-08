/**
 * TypeScript interfaces for the Strands module
 */

/**
 * Represents a single sync operation's result
 */
export interface SyncLog {
  timestamp: string;
  summary: string;
  tags: string[];
  synced_by_ai: boolean;
  notes?: string;
}

/**
 * Represents a Strand - a piece of captured information that has been enriched with AI
 */
export interface Strand {
  id: string;
  user_id: string;
  content: string;
  source: string; // "whatsapp", "manual", etc.
  tags: string[];
  summary: string;
  related_ids: string[];
  synced_with_ai: boolean; // Whether the strand has been processed by AI
  sync_history: SyncLog[];
  created_at: string;
  updated_at: string;
}

/**
 * Request to create or update a strand
 */
export interface StrandRequest {
  content: string;
  source?: string;
  tags?: string[];
}

/**
 * Response from the Strands API
 */
export interface StrandResponse {
  strand?: Strand;
  strands?: Strand[];
  tags?: string[];
  error?: string;
  count?: number;
  page?: number;
  limit?: number;
}

/**
 * Parameters for fetching strands
 */
export interface StrandQueryParams {
  tags?: string[];
  page?: number;
  limit?: number;
}

/**
 * Response from sync operation
 */
export interface SyncResponse {
  status: string;
  message: string;
}
