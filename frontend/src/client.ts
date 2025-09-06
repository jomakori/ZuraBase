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
  try {
    const apiBase = getApiBase();
    const url = `${apiBase}/images/${encodeURIComponent(query)}`;

    const resp = await fetch(url);

    if (!resp.ok) {
      const errorText = await resp.text();
      throw new Error(errorText);
    }

    const data = await resp.json();
    return data;
  } catch (error) {
    throw error;
  }
}
