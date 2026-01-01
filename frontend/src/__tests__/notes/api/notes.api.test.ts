/**
 * Tests for Notes API client
 */

import { getNote, saveNote, deleteNote } from '@/features/notes';
import { setupMockHandlers, cleanupMockHandlers } from '@/shared/fixtures/mockHandlers';
import { mockNotes } from '@/shared/fixtures/mockData';

// Mock the auth refresh module
jest.mock('@/shared/utils/authRefresh', () => ({
  handleAuthError: jest.fn().mockResolvedValue(false),
}));

// Mock the client logger
jest.mock('@/shared/utils/clientLogger', () => ({
  log: {
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('Notes API', () => {
  beforeEach(() => {
    setupMockHandlers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanupMockHandlers();
  });

  describe('getNote', () => {
    it('fetches a note successfully', async () => {
      const noteId = 'note-1';
      const result = await getNote(noteId);
      expect(result).toEqual(mockNotes[0]);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/note/${noteId}`),
        expect.objectContaining({
          headers: { Accept: 'application/json' },
          credentials: 'include',
        })
      );
      // Ensure method is GET (default)
      const call = (global.fetch as jest.Mock).mock.calls[0];
      expect(call[1]?.method || 'GET').toBe('GET');
    });

    it('throws error when note not found', async () => {
      // Mock fetch to return 404
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Note not found'),
      });

      await expect(getNote('nonexistent')).rejects.toThrow('Note not found');
    });

    it('handles network errors', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
      await expect(getNote('note-1')).rejects.toThrow('Network error');
    });

    it('handles authentication errors', async () => {
      // Mock fetch to return 401
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      });

      const { handleAuthError } = require('@/shared/utils/authRefresh');
      handleAuthError.mockResolvedValue(true);

      await expect(getNote('note-1')).rejects.toThrow('Unauthorized');
    });
  });

  describe('saveNote', () => {
    it('creates a new note successfully', async () => {
      const newNote = {
        id: 'new-note-id',
        text: '# New Note',
        cover_url: 'https://example.com/cover.jpg',
      };
      const result = await saveNote(newNote);
      expect(result).toHaveProperty('id', 'new-note-id');
      expect(result).toHaveProperty('text', newNote.text);
      expect(result).toHaveProperty('cover_url', newNote.cover_url);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/note'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newNote),
          credentials: 'include',
        })
      );
    });

    it('updates an existing note successfully', async () => {
      const existingNote = {
        id: 'note-1',
        text: '# Updated Note',
        cover_url: 'https://example.com/updated.jpg',
      };
      const result = await saveNote(existingNote);
      expect(result).toHaveProperty('id', 'note-1');
      expect(result).toHaveProperty('text', existingNote.text);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/note'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(existingNote),
        })
      );
    });

    it('throws error when save fails', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal server error'),
      });

      const note = { id: 'note-1', text: 'test', cover_url: '' };
      await expect(saveNote(note)).rejects.toThrow('Internal server error');
    });

    it('handles missing fields gracefully', async () => {
      const note = { id: 'note-1', text: '', cover_url: '' };
      const result = await saveNote(note);
      expect(result).toBeDefined();
      // The mock handler will return a note with those fields
    });
  });

  describe('deleteNote', () => {
    it('deletes a note successfully', async () => {
      const noteId = 'note-1';
      await deleteNote(noteId);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/note/${noteId}`),
        expect.objectContaining({
          method: 'DELETE',
        })
      );
    });

    it('throws error when delete fails', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Note not found'),
      });

      await expect(deleteNote('nonexistent')).rejects.toThrow('Note not found');
    });

    it('handles network errors', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
      await expect(deleteNote('note-1')).rejects.toThrow('Network error');
    });
  });

  // Edge cases and error handling
  describe('error handling', () => {
    it('propagates error messages from response text', async () => {
      const errorMessage = 'Custom validation error';
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve(errorMessage),
      });

      await expect(getNote('note-1')).rejects.toThrow(errorMessage);
    });

    it('handles non-JSON error responses', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 502,
        text: () => Promise.resolve('<html>Bad Gateway</html>'),
      });

      await expect(getNote('note-1')).rejects.toThrow('<html>Bad Gateway</html>');
    });
  });

  // Request/response transformations
  describe('request/response transformations', () => {
    it('encodes note ID in URL', async () => {
      const noteId = 'note/with/slashes';
      // Mock fetch to succeed for this specific ID
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          id: noteId,
          text: '',
          cover_url: '',
          title: '',
          content: '',
          user_id: 'user-123',
          created_at: '',
          updated_at: '',
          is_public: false,
          cover_image: null,
        }),
        text: () => Promise.resolve(''),
      });
      await getNote(noteId);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/note/${encodeURIComponent(noteId)}`),
        expect.anything()
      );
    });

    it('preserves note text in request body', async () => {
      const note = {
        id: 'note-1',
        text: '# Markdown with special chars: & < > " \'',
        cover_url: '',
      };
      await saveNote(note);
      const call = (global.fetch as jest.Mock).mock.calls[0];
      const body = JSON.parse(call[1].body);
      expect(body.text).toBe(note.text);
    });

    it('returns Note type with correct shape', async () => {
      const note = await getNote('note-1');
      expect(note).toHaveProperty('id');
      expect(note).toHaveProperty('text');
      expect(note).toHaveProperty('cover_url');
      // Additional fields may be present from mock data
    });
  });
});
