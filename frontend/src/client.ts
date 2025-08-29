/**
 * Minimal API client for the Go backend.
 * Provides functions for notes and image search.
 */

import { getApiBase } from "./getApiBase";

export interface Note {
  id: string;
  text: string;
  cover_url: string;
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

/** Fetch a note by ID */
export async function getNote(id: string): Promise<Note> {
  console.log("[API] getNote", { id });
  const resp = await fetch(`${getApiBase()}/note/${encodeURIComponent(id)}`);
  if (!resp.ok) throw new Error(await resp.text());
  return await resp.json();
}

/** Save a note (create or update) */
export async function saveNote(note: Note): Promise<Note> {
  // For privacy, do not log the note text
  console.log("[API] saveNote", { id: note.id, cover_url: note.cover_url });
  const resp = await fetch(`${getApiBase()}/note`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(note),
  });
  if (!resp.ok) throw new Error(await resp.text());
  return await resp.json();
}

/** Search for images using the backend's /images/:query endpoint */
export async function searchPhoto(query: string): Promise<SearchResponse> {
  console.log("[API] searchPhoto", { query });
  const resp = await fetch(`${getApiBase()}/images/${encodeURIComponent(query)}`);
  if (!resp.ok) throw new Error(await resp.text());
  return await resp.json();
}
