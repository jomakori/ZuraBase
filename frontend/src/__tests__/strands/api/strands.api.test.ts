/**
 * Tests for Strands API client
 */

import { StrandsApi } from '@/features/strands/api/strands.api';
import { setupMockHandlers, cleanupMockHandlers } from '@/shared/fixtures/mockHandlers';
import { mockStrands } from '@/shared/fixtures/mockData';

// Mock the auth refresh module
jest.mock('@/shared/utils/authRefresh', () => ({
  handleAuthError: jest.fn().mockResolvedValue(false),
}));

// Mock the client logger
jest.mock('@/shared/utils/clientLogger', () => ({
  log: {
    apiRequest: jest.fn(),
    apiResponse: jest.fn(),
    apiError: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Strands API', () => {
  beforeEach(() => {
    setupMockHandlers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanupMockHandlers();
  });

  describe('getStrands', () => {
    it('fetches strands successfully', async () => {
      const result = await StrandsApi.getStrands();
      expect(result).toBeDefined();
      expect(result.strands).toBeDefined();
      expect(Array.isArray(result.strands)).toBe(true);
      const calls = (global.fetch as jest.Mock).mock.calls;
      expect(calls[0][0]).toContain('/api/strands');
    });

    it('fetches strands with tags filter', async () => {
      const params = { tags: ['tag1', 'tag2'] };
      await StrandsApi.getStrands(params);
      const calls = (global.fetch as jest.Mock).mock.calls;
      expect(calls[0][0]).toContain('tags=tag1%2Ctag2');
    });

    it('fetches strands with pagination', async () => {
      const params = { page: 2, limit: 20 };
      await StrandsApi.getStrands(params);
      const calls = (global.fetch as jest.Mock).mock.calls;
      expect(calls[0][0]).toContain('page=2');
      expect(calls[0][0]).toContain('limit=20');
    });

    it('throws error when fetch fails', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(StrandsApi.getStrands()).rejects.toThrow('Failed to fetch strands: Internal Server Error');
    });
  });

  describe('getStrand', () => {
    it('fetches a single strand successfully', async () => {
      const strandId = 'strand-1';
      const result = await StrandsApi.getStrand(strandId);
      expect(result).toBeDefined();
      expect(result.strand).toBeDefined();
      expect(result.strand?.id).toBe(strandId);
      const calls = (global.fetch as jest.Mock).mock.calls;
      expect(calls[0][0]).toContain(`/api/strands/${strandId}`);
    });

    it('handles 401 error with auth refresh', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      });

      await expect(StrandsApi.getStrand('strand-1')).rejects.toThrow('Failed to fetch strand');
      // handleAuthError should have been called
      const { handleAuthError } = require('@/shared/utils/authRefresh');
      expect(handleAuthError).toHaveBeenCalledWith(401);
    });

    it('throws error when strand not found', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Strand not found'),
      });

      await expect(StrandsApi.getStrand('nonexistent')).rejects.toThrow('Failed to fetch strand');
    });

    it('handles network errors gracefully', async () => {
      global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));
      await expect(StrandsApi.getStrand('strand-1')).rejects.toThrow('Failed to fetch');
    });
  });

  describe('createStrand', () => {
    it('creates a strand successfully', async () => {
      const strandRequest = {
        content: 'Test content',
        source: 'manual',
        tags: ['test'],
      };
      const result = await StrandsApi.createStrand(strandRequest);
      expect(result).toBeDefined();
      expect(result.strand).toBeDefined();
      expect(result.strand?.content).toBe(strandRequest.content);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/strands'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(strandRequest),
          credentials: 'include',
        })
      );
    });

    it('throws error when creation fails', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Validation error'),
      });

      await expect(StrandsApi.createStrand({ content: '' })).rejects.toThrow('Failed to create strand');
    });
  });

  describe('updateStrand', () => {
    it('updates a strand successfully', async () => {
      const strandId = 'strand-1';
      const strandRequest = {
        content: 'Updated content',
        tags: ['updated'],
      };
      const result = await StrandsApi.updateStrand(strandId, strandRequest);
      expect(result).toBeDefined();
      expect(result.strand).toBeDefined();
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/api/strands/${strandId}`),
        expect.objectContaining({
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(strandRequest),
          credentials: 'include',
        })
      );
    });

    it('handles 401 error with auth refresh', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      });

      await expect(StrandsApi.updateStrand('strand-1', { content: 'test' })).rejects.toThrow('Failed to update strand');
      const { handleAuthError } = require('@/shared/utils/authRefresh');
      expect(handleAuthError).toHaveBeenCalledWith(401);
    });

    it('throws error when update fails', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal server error'),
      });

      await expect(StrandsApi.updateStrand('strand-1', { content: 'test' })).rejects.toThrow('Failed to update strand');
    });
  });

  describe('deleteStrand', () => {
    it('deletes a strand successfully', async () => {
      const strandId = 'strand-1';
      await StrandsApi.deleteStrand(strandId);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/api/strands/${strandId}`),
        expect.objectContaining({
          method: 'DELETE',
          credentials: 'include',
        })
      );
    });

    it('throws error when delete fails', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      await expect(StrandsApi.deleteStrand('nonexistent')).rejects.toThrow('Failed to delete strand: Not Found');
    });
  });

  describe('getTags', () => {
    it('fetches tags successfully', async () => {
      const result = await StrandsApi.getTags();
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      const calls = (global.fetch as jest.Mock).mock.calls;
      expect(calls[0][0]).toContain('/api/strands/tags');
    });

    it('throws error when fetch fails', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
      });

      await expect(StrandsApi.getTags()).rejects.toThrow('Failed to fetch tags: Internal Server Error');
    });
  });

  describe('syncStrand', () => {
    it('syncs a strand successfully', async () => {
      const strandId = 'strand-1';
      const result = await StrandsApi.syncStrand(strandId);
      expect(result).toBeDefined();
      expect(result.status).toBeDefined();
      expect(result.message).toBeDefined();
      const calls = (global.fetch as jest.Mock).mock.calls;
      expect(calls[0][0]).toContain(`/api/strands/${strandId}/sync`);
    });

    it('handles 401 error with auth refresh', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      });

      await expect(StrandsApi.syncStrand('strand-1')).rejects.toThrow('Failed to sync strand');
      const { handleAuthError } = require('@/shared/utils/authRefresh');
      expect(handleAuthError).toHaveBeenCalledWith(401);
    });

    it('throws error when sync fails', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Sync failed'),
      });

      await expect(StrandsApi.syncStrand('strand-1')).rejects.toThrow('Failed to sync strand');
    });
  });

  describe('getStrandHistory', () => {
    it('fetches sync history successfully', async () => {
      const strandId = 'strand-1';
      const result = await StrandsApi.getStrandHistory(strandId);
      expect(result).toBeDefined();
      expect(result.sync_history).toBeDefined();
      expect(Array.isArray(result.sync_history)).toBe(true);
      const calls = (global.fetch as jest.Mock).mock.calls;
      expect(calls[0][0]).toContain(`/api/strands/${strandId}/sync-history`);
    });

    it('handles 401 error with auth refresh', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      });

      await expect(StrandsApi.getStrandHistory('strand-1')).rejects.toThrow('Failed to fetch sync history');
      const { handleAuthError } = require('@/shared/utils/authRefresh');
      expect(handleAuthError).toHaveBeenCalledWith(401);
    });

    it('throws error when fetch fails', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal server error'),
      });

      await expect(StrandsApi.getStrandHistory('strand-1')).rejects.toThrow('Failed to fetch sync history');
    });
  });

  describe('rollbackStrand', () => {
    it('rolls back a strand successfully', async () => {
      const strandId = 'strand-1';
      const timestamp = '2025-01-01T00:00:00Z';
      const result = await StrandsApi.rollbackStrand(strandId, timestamp);
      expect(result).toBeDefined();
      expect(result.strand).toBeDefined();
      const calls = (global.fetch as jest.Mock).mock.calls;
      expect(calls[0][0]).toContain(`/api/strands/${strandId}/rollback`);
    });

    it('handles 401 error with auth refresh', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      });

      await expect(StrandsApi.rollbackStrand('strand-1', 'timestamp')).rejects.toThrow('Failed to rollback strand');
      const { handleAuthError } = require('@/shared/utils/authRefresh');
      expect(handleAuthError).toHaveBeenCalledWith(401);
    });

    it('throws error when rollback fails', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Rollback failed'),
      });

      await expect(StrandsApi.rollbackStrand('strand-1', 'timestamp')).rejects.toThrow('Failed to rollback strand');
    });
  });

  describe('uploadFiles', () => {
    it('uploads files successfully', async () => {
      const strandId = 'strand-1';
      const files = [new File(['content'], 'test.txt', { type: 'text/plain' })];
      const result = await StrandsApi.uploadFiles(strandId, files);
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      const calls = (global.fetch as jest.Mock).mock.calls;
      expect(calls[0][0]).toContain(`/api/strands/${strandId}/upload`);
    });

    it('handles 401 error with auth refresh', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      });

      const files = [new File(['content'], 'test.txt', { type: 'text/plain' })];
      await expect(StrandsApi.uploadFiles('strand-1', files)).rejects.toThrow('Failed to upload files');
      const { handleAuthError } = require('@/shared/utils/authRefresh');
      expect(handleAuthError).toHaveBeenCalledWith(401);
    });

    it('throws error when upload fails', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Upload failed'),
      });

      const files = [new File(['content'], 'test.txt', { type: 'text/plain' })];
      await expect(StrandsApi.uploadFiles('strand-1', files)).rejects.toThrow('Failed to upload files');
    });
  });

  describe('deleteAttachment', () => {
    it('deletes an attachment successfully', async () => {
      const strandId = 'strand-1';
      const attachmentId = 'attachment-1';
      await StrandsApi.deleteAttachment(strandId, attachmentId);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/api/strands/${strandId}/attachments/${attachmentId}`),
        expect.objectContaining({
          method: 'DELETE',
          credentials: 'include',
        })
      );
    });

    it('handles 401 error with auth refresh', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      });

      await expect(StrandsApi.deleteAttachment('strand-1', 'attachment-1')).rejects.toThrow('Failed to delete attachment');
      const { handleAuthError } = require('@/shared/utils/authRefresh');
      expect(handleAuthError).toHaveBeenCalledWith(401);
    });

    it('throws error when delete fails', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Delete failed'),
      });

      await expect(StrandsApi.deleteAttachment('strand-1', 'attachment-1')).rejects.toThrow('Failed to delete attachment');
    });
  });

  describe('Error handling', () => {
    it('propagates error messages from response text', async () => {
      const errorMessage = 'Custom validation error';
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve(errorMessage),
      });

      await expect(StrandsApi.getStrand('strand-1')).rejects.toThrow(errorMessage);
    });

    it('handles non-JSON error responses', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 502,
        text: () => Promise.resolve('<html>Bad Gateway</html>'),
      });

      await expect(StrandsApi.getStrand('strand-1')).rejects.toThrow('<html>Bad Gateway</html>');
    });
  });
});
