/**
 * Minimal API client for the Go backend.
 * Provides functions for image search.
 */

import { getApiBase } from "./getApiBase";

export interface APIError extends Error {
  status?: number;
  statusText?: string;
}

export interface SearchResponse {
  photos: {
    id: number;
    src: {
      medium: string;
      landscape: string;
    };
    alt: string;
  }[];
}

/** Search for images using the backend's /images/:query endpoint */
export async function searchPhoto(query: string): Promise<SearchResponse> {
  console.log("[API] searchPhoto", { query });
  
  try {
    const apiBase = getApiBase();
    console.log("[API] Using API base:", apiBase);
    
    const url = `${apiBase}/images/${encodeURIComponent(query)}`;
    console.log("[API] Request URL:", url);
    
    const resp = await fetch(url);
    console.log("[API] Response status:", resp.status);
    
    if (!resp.ok) {
      const errorText = await resp.text();
      console.error("[API] Error response:", errorText);
      throw new Error(errorText);
    }
    
    const data = await resp.json();
    console.log("[API] Response data:", data);
    return data;
  } catch (error) {
    console.error("[API] Error in searchPhoto:", error);
    throw error;
  }
}
