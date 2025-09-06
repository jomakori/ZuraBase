import { getApiBase } from "../getApiBase";
import { Note } from "./types";

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

/** Delete a note by ID */
export async function deleteNote(id: string): Promise<void> {
  console.log("[API] deleteNote", { id });
  const resp = await fetch(`${getApiBase()}/note/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!resp.ok) throw new Error(await resp.text());
}
