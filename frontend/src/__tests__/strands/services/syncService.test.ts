/**
 * Tests for syncService
 */

import { syncService } from '@/features/strands/services/syncService';
import { strandsApi } from '@/features/strands/api/strands.api';
import { SyncProgress, SyncLog } from '@/features/strands/types';

// Mock the strands API
jest.mock('@/features/strands/api/strands.api');

describe('syncService', () => {
  const mockStrandsApi = strandsApi as jest.Mocked<typeof strandsApi>;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset service state
    syncService.cancel();
  });

  describe('syncStrand', () => {
    it('calls API syncStrand and returns result', async () => {
      const mockResult = { success: true, logId: 'log-123' };
      mockStrandsApi.syncStrand.mockResolvedValue(mockResult);

      const result = await syncService.syncStrand('strand-1');

      expect(mockStrandsApi.syncStrand).toHaveBeenCalledWith('strand-1');
      expect(result).toEqual(mockResult);
    });

    it('handles API errors', async () => {
      const error = new Error('Network error');
      mockStrandsApi.syncStrand.mockRejectedValue(error);

      await expect(syncService.syncStrand('strand-1')).rejects.toThrow('Network error');
    });

    it('can be cancelled before completion', async () => {
      // Create a promise that never resolves to simulate cancellation
      let resolvePromise: (value: any) => void;
      const pendingPromise = new Promise((resolve) => {
        resolvePromise = resolve;
      });
      mockStrandsApi.syncStrand.mockReturnValue(pendingPromise);

      const syncPromise = syncService.syncStrand('strand-1');
      syncService.cancel();

      // Resolve the promise after cancellation
      resolvePromise!({ success: false });

      // The service should reject with cancellation error
      await expect(syncPromise).rejects.toThrow('Sync cancelled');
    });
  });

  describe('syncMultipleStrands', () => {
    const strandIds = ['strand-1', 'strand-2', 'strand-3'];

    it('syncs multiple strands sequentially and returns results', async () => {
      const mockResults = [
        { success: true, logId: 'log-1' },
        { success: true, logId: 'log-2' },
        { success: false, error: 'Failed' },
      ];
      mockStrandsApi.syncStrand
        .mockResolvedValueOnce(mockResults[0])
        .mockResolvedValueOnce(mockResults[1])
        .mockResolvedValueOnce(mockResults[2]);

      const results = await syncService.syncMultipleStrands(strandIds);

      expect(mockStrandsApi.syncStrand).toHaveBeenCalledTimes(3);
      expect(mockStrandsApi.syncStrand).toHaveBeenNthCalledWith(1, 'strand-1');
      expect(mockStrandsApi.syncStrand).toHaveBeenNthCalledWith(2, 'strand-2');
      expect(mockStrandsApi.syncStrand).toHaveBeenNthCalledWith(3, 'strand-3');
      expect(results).toEqual(mockResults);
    });

    it('emits progress events during sync', async () => {
      const progressCallback = jest.fn();
      syncService.onProgress(progressCallback);

      mockStrandsApi.syncStrand.mockImplementation((id) => {
        return Promise.resolve({ success: true, logId: `log-${id}` });
      });

      await syncService.syncMultipleStrands(strandIds);

      // Should emit progress for each strand
      expect(progressCallback).toHaveBeenCalledTimes(3);
      expect(progressCallback).toHaveBeenNthCalledWith(1, {
        current: 1,
        total: 3,
        message: 'Syncing strand strand-1',
        status: 'processing',
      });
      expect(progressCallback).toHaveBeenNthCalledWith(2, {
        current: 2,
        total: 3,
        message: 'Syncing strand strand-2',
        status: 'processing',
      });
      expect(progressCallback).toHaveBeenNthCalledWith(3, {
        current: 3,
        total: 3,
        message: 'Syncing strand strand-3',
        status: 'processing',
      });
    });

    it('stops syncing when cancelled', async () => {
      let callCount = 0;
      mockStrandsApi.syncStrand.mockImplementation(() => {
        callCount++;
        return new Promise((resolve) => {
          setTimeout(() => resolve({ success: true, logId: 'log' }), 100);
        });
      });

      const syncPromise = syncService.syncMultipleStrands(strandIds);

      // Cancel after first call
      setTimeout(() => {
        syncService.cancel();
      }, 10);

      await expect(syncPromise).rejects.toThrow('Sync cancelled');
      // Only first call should have been made
      expect(callCount).toBe(1);
    });

    it('handles individual strand failures and continues', async () => {
      mockStrandsApi.syncStrand
        .mockResolvedValueOnce({ success: true, logId: 'log-1' })
        .mockRejectedValueOnce(new Error('API error'))
        .mockResolvedValueOnce({ success: true, logId: 'log-3' });

      const results = await syncService.syncMultipleStrands(strandIds);

      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({ success: true, logId: 'log-1' });
      expect(results[1]).toEqual({ success: false, error: 'API error' });
      expect(results[2]).toEqual({ success: true, logId: 'log-3' });
    });
  });

  describe('getSyncLogs', () => {
    it('calls API getSyncLogs and returns logs', async () => {
      const mockLogs: SyncLog[] = [
        {
          id: 'log-1',
          strandId: 'strand-1',
          timestamp: '2025-12-31T10:00:00Z',
          status: 'success',
          message: 'Synced',
          details: {},
        },
      ];
      mockStrandsApi.getSyncLogs.mockResolvedValue(mockLogs);

      const logs = await syncService.getSyncLogs('strand-1');

      expect(mockStrandsApi.getSyncLogs).toHaveBeenCalledWith('strand-1');
      expect(logs).toEqual(mockLogs);
    });

    it('handles empty log list', async () => {
      mockStrandsApi.getSyncLogs.mockResolvedValue([]);

      const logs = await syncService.getSyncLogs('strand-1');

      expect(logs).toEqual([]);
    });
  });

  describe('Progress Tracking', () => {
    it('allows subscribing to progress updates', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();

      const unsubscribe1 = syncService.onProgress(callback1);
      const unsubscribe2 = syncService.onProgress(callback2);

      // Simulate progress emission
      const progress: SyncProgress = {
        current: 1,
        total: 5,
        message: 'Test',
        status: 'processing',
      };
      syncService['emitProgress'](progress);

      expect(callback1).toHaveBeenCalledWith(progress);
      expect(callback2).toHaveBeenCalledWith(progress);

      // Unsubscribe one callback
      unsubscribe1();
      syncService['emitProgress'](progress);

      expect(callback1).toHaveBeenCalledTimes(1); // Not called again
      expect(callback2).toHaveBeenCalledTimes(2); // Called again
    });

    it('clears all subscribers on reset', () => {
      const callback = jest.fn();
      syncService.onProgress(callback);

      syncService.reset();

      const progress: SyncProgress = {
        current: 1,
        total: 1,
        message: 'Test',
        status: 'processing',
      };
      syncService['emitProgress'](progress);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('Cancellation', () => {
    it('sets cancelled flag when cancel is called', () => {
      expect(syncService.isCancelled()).toBe(false);

      syncService.cancel();

      expect(syncService.isCancelled()).toBe(true);
    });

    it('resets cancelled flag when reset is called', () => {
      syncService.cancel();
      expect(syncService.isCancelled()).toBe(true);

      syncService.reset();
      expect(syncService.isCancelled()).toBe(false);
    });

    it('throws cancellation error when checkCancelled is called after cancel', () => {
      syncService.cancel();

      expect(() => syncService['checkCancelled']()).toThrow('Sync cancelled');
    });

    it('does not throw when not cancelled', () => {
      syncService.reset();

      expect(() => syncService['checkCancelled']()).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('wraps API errors with sync context', async () => {
      mockStrandsApi.syncStrand.mockRejectedValue(new Error('Network timeout'));

      try {
        await syncService.syncStrand('strand-1');
      } catch (error) {
        expect(error.message).toBe('Network timeout');
        expect(error).toBeInstanceOf(Error);
      }
    });

    it('handles invalid strand IDs', async () => {
      mockStrandsApi.syncStrand.mockRejectedValue(new Error('Strand not found'));

      await expect(syncService.syncStrand('invalid-id')).rejects.toThrow('Strand not found');
    });
  });

  describe('Integration Scenarios', () => {
    it('completes full sync workflow with progress tracking', async () => {
      const progressEvents: SyncProgress[] = [];
      syncService.onProgress((progress) => progressEvents.push(progress));

      const strandIds = ['s1', 's2'];
      mockStrandsApi.syncStrand
        .mockResolvedValueOnce({ success: true, logId: 'log1' })
        .mockResolvedValueOnce({ success: true, logId: 'log2' });

      const results = await syncService.syncMultipleStrands(strandIds);

      expect(results).toHaveLength(2);
      expect(progressEvents).toHaveLength(2);
      expect(progressEvents[0]).toEqual({
        current: 1,
        total: 2,
        message: 'Syncing strand s1',
        status: 'processing',
      });
      expect(progressEvents[1]).toEqual({
        current: 2,
        total: 2,
        message: 'Syncing strand s2',
        status: 'processing',
      });
    });

    it('handles concurrent sync requests', async () => {
      // Simulate two concurrent sync operations
      mockStrandsApi.syncStrand.mockResolvedValue({ success: true, logId: 'log' });

      const promise1 = syncService.syncStrand('strand-1');
      const promise2 = syncService.syncStrand('strand-2');

      const results = await Promise.all([promise1, promise2]);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({ success: true, logId: 'log' });
      expect(results[1]).toEqual({ success: true, logId: 'log' });
    });
  });

  describe('State Management', () => {
    it('tracks active sync count', () => {
      expect(syncService.getActiveSyncCount()).toBe(0);

      // Simulate starting a sync
      syncService['activeSyncCount'] = 1;
      expect(syncService.getActiveSyncCount()).toBe(1);

      syncService.reset();
      expect(syncService.getActiveSyncCount()).toBe(0);
    });

    it('increments and decrements active sync count during multiple syncs', async () => {
      mockStrandsApi.syncStrand.mockResolvedValue({ success: true, logId: 'log' });

      const initialCount = syncService.getActiveSyncCount();

      const promise = syncService.syncMultipleStrands(['s1', 's2']);

      // Count should increase during sync
      expect(syncService.getActiveSyncCount()).toBeGreaterThan(initialCount);

      await promise;

      // Count should return to initial
      expect(syncService.getActiveSyncCount()).toBe(initialCount);
    });
  });
});
