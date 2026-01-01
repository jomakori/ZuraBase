/**
 * Integration tests for complete Strands workflows
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import StrandsApp from '@/features/strands/components/StrandsApp';
import { setupMockHandlers, cleanupMockHandlers } from '@/shared/fixtures/mockHandlers';
import { mockStrands, mockSyncLogs } from '@/shared/fixtures/mockData';
import { strandsApi } from '@/features/strands/api/strands.api';
import { syncService } from '@/features/strands/services/syncService';

// Mock child components to simplify testing
jest.mock('@/features/strands/components/StrandDetail', () => ({
  __esModule: true,
  default: ({ strandId, onBack, onDeleted }: any) => {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'strand-detail' },
      React.createElement('h2', null, 'Strand Detail ', strandId),
      React.createElement('button', { onClick: onBack }, 'Back'),
      React.createElement('button', { onClick: onDeleted }, 'Delete')
    );
  },
}));

jest.mock('@/features/strands/components/StrandCard', () => ({
  __esModule: true,
  default: ({ strand, onSelect, onDelete }: any) => {
    const React = require('react');
    return React.createElement('div', { 'data-testid': `strand-card-${strand.id}` },
      React.createElement('h3', null, strand.title),
      React.createElement('button', { onClick: () => onSelect(strand) }, 'Select'),
      React.createElement('button', { onClick: () => onDelete(strand.id) }, 'Delete')
    );
  },
}));

jest.mock('@/features/strands/components/TagFilter', () => ({
  __esModule: true,
  default: ({ tags, selectedTags, onTagToggle }: any) => {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'tag-filter' },
      tags.map((tag: string) =>
        React.createElement('button', {
          key: tag,
          'data-testid': `tag-${tag}`,
          onClick: () => onTagToggle(tag)
        }, tag)
      )
    );
  },
}));

jest.mock('@/features/strands/components/FileUpload', () => ({
  __esModule: true,
  default: ({ onFilesSelected, disabled }: any) => {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'file-upload' },
      React.createElement('button', {
        onClick: () => onFilesSelected?.([new File([''], 'test.txt')]),
        disabled: disabled
      }, 'Upload')
    );
  },
}));

jest.mock('@/features/strands/components/SyncProgressModal', () => ({
  __esModule: true,
  default: ({ isOpen, progress, onClose, onCancel }: any) => {
    const React = require('react');
    return isOpen
      ? React.createElement('div', { 'data-testid': 'sync-progress-modal' },
          React.createElement('div', null, 'Progress: ', progress?.status),
          React.createElement('button', { onClick: onClose }, 'Close'),
          React.createElement('button', { onClick: onCancel }, 'Cancel')
        )
      : null;
  },
}));

jest.mock('@/features/strands/components/SyncLogViewer', () => ({
  __esModule: true,
  default: ({ logs, isLoading, onRefresh, onClear }: any) => {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'sync-log-viewer' },
      React.createElement('div', null, 'Sync Logs (', logs.length, ')'),
      React.createElement('button', { onClick: onRefresh }, 'Refresh'),
      React.createElement('button', { onClick: onClear }, 'Clear')
    );
  },
}));

jest.mock('@/features/strands/components/AttachmentList', () => ({
  __esModule: true,
  default: ({ attachments, onDownload, onDelete, onPreview }: any) => {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'attachment-list' },
      attachments.map((att: any) =>
        React.createElement('div', { key: att.id },
          att.filename,
          React.createElement('button', { onClick: () => onDownload(att) }, 'Download'),
          React.createElement('button', { onClick: () => onDelete(att.id) }, 'Delete')
        )
      )
    );
  },
}));

// Mock the API
jest.mock('@/features/strands/api/strands.api', () => ({
  strandsApi: {
    getStrands: jest.fn(),
    getStrand: jest.fn(),
    createStrand: jest.fn(),
    updateStrand: jest.fn(),
    deleteStrand: jest.fn(),
    syncStrand: jest.fn(),
    getSyncLogs: jest.fn(),
    uploadFiles: jest.fn(),
    deleteAttachment: jest.fn(),
  },
}));

// Mock syncService
jest.mock('@/features/strands/services/syncService', () => ({
  syncService: {
    syncStrand: jest.fn(),
    syncMultipleStrands: jest.fn(),
    getSyncLogs: jest.fn(),
    onProgress: jest.fn(),
    cancel: jest.fn(),
    reset: jest.fn(),
  },
}));

describe('Strands Integration Workflows', () => {
  let user: ReturnType<typeof userEvent.setup>;
  const mockStrandsApi = strandsApi as jest.Mocked<typeof strandsApi>;
  const mockSyncService = syncService as jest.Mocked<typeof syncService>;

  beforeEach(() => {
    user = userEvent.setup();
    setupMockHandlers();
    jest.clearAllMocks();

    // Default API mocks
    mockStrandsApi.getStrands.mockResolvedValue({ strands: mockStrands });
    mockStrandsApi.getStrand.mockImplementation((id) =>
      Promise.resolve({ strand: mockStrands.find(s => s.id === id) })
    );
    mockStrandsApi.createStrand.mockResolvedValue({
      strand: {
        id: 'new-strand-id',
        title: 'New Strand',
        content: 'Content',
        tags: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userId: 'user-1',
        syncStatus: 'pending',
      },
    });
    mockStrandsApi.updateStrand.mockResolvedValue({
      strand: {
        id: 'strand-1',
        title: 'Updated Strand',
        content: 'Updated content',
        tags: ['updated'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        userId: 'user-1',
        syncStatus: 'pending',
      },
    });
    mockStrandsApi.deleteStrand.mockResolvedValue({ success: true });
    mockStrandsApi.syncStrand.mockResolvedValue({ success: true, logId: 'log-123' });
    mockStrandsApi.getSyncLogs.mockResolvedValue({ logs: mockSyncLogs });
    mockStrandsApi.uploadFiles.mockResolvedValue([]);
    mockStrandsApi.deleteAttachment.mockResolvedValue({ success: true });

    // Sync service mocks
    mockSyncService.syncStrand.mockResolvedValue({ success: true, logId: 'log-123' });
    mockSyncService.syncMultipleStrands.mockResolvedValue([
      { success: true, logId: 'log-1' },
      { success: true, logId: 'log-2' },
    ]);
    mockSyncService.getSyncLogs.mockResolvedValue(mockSyncLogs);
    mockSyncService.onProgress.mockReturnValue(() => {});
    mockSyncService.cancel.mockImplementation(() => {});
    mockSyncService.reset.mockImplementation(() => {});
  });

  afterEach(() => {
    cleanupMockHandlers();
  });

  const renderStrandsApp = (initialPath = '/strands') => {
    return render(
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/strands" element={<StrandsApp />} />
          <Route path="/strands/:id" element={<StrandsApp />} />
        </Routes>
      </MemoryRouter>
    );
  };

  describe('Create → View → Edit → Delete Workflow', () => {
    it('completes full CRUD lifecycle for a strand', async () => {
      renderStrandsApp();

      // Wait for strands list
      await waitFor(() => {
        expect(screen.getByText('Strands')).toBeInTheDocument();
      });

      // Click "New Strand"
      const createButton = screen.getByRole('button', { name: 'New Strand' });
      await user.click(createButton);

      // Fill form
      await user.type(screen.getByLabelText('Title'), 'Integration Test Strand');
      await user.type(screen.getByLabelText('Content'), 'Test content');
      await user.type(screen.getByLabelText('Tags'), 'integration, test');
      await user.keyboard('{Enter}');

      // Submit
      const submitButton = screen.getByRole('button', { name: 'Create Strand' });
      await user.click(submitButton);

      // Verify API call
      await waitFor(() => {
        expect(mockStrandsApi.createStrand).toHaveBeenCalledWith({
          title: 'Integration Test Strand',
          content: 'Test content',
          tags: ['integration', 'test'],
        });
      });

      // Verify new strand appears in list (mocked API returns new strand)
      await waitFor(() => {
        expect(screen.getByText('New Strand')).toBeInTheDocument();
      });

      // Click to view detail (mocked detail component)
      const strandCard = screen.getByTestId('strand-card-new-strand-id');
      const selectButton = within(strandCard).getByText('Select');
      await user.click(selectButton);

      // Verify detail view appears
      await waitFor(() => {
        expect(screen.getByTestId('strand-detail')).toBeInTheDocument();
      });

      // Delete the strand
      const deleteButton = screen.getByText('Delete');
      await user.click(deleteButton);

      // Verify delete API call
      await waitFor(() => {
        expect(mockStrandsApi.deleteStrand).toHaveBeenCalledWith('new-strand-id');
      });
    });
  });

  describe('File Upload → Attachment → Download Workflow', () => {
    it('uploads a file and manages attachments', async () => {
      renderStrandsApp('/strands/strand-1');

      // Wait for detail view
      await waitFor(() => {
        expect(screen.getByTestId('strand-detail')).toBeInTheDocument();
      });

      // Trigger file upload
      const uploadButton = screen.getByTestId('file-upload').querySelector('button');
      await user.click(uploadButton!);

      // Verify upload API call
      expect(mockStrandsApi.uploadFiles).toHaveBeenCalledWith('strand-1', expect.any(Array));

      // Mock attachment list
      mockStrandsApi.uploadFiles.mockResolvedValue([
        {
          id: 'att-1',
          filename: 'test.pdf',
          url: '/uploads/test.pdf',
          size: 1024,
          mimeType: 'application/pdf',
          uploadedAt: new Date().toISOString(),
        },
      ]);

      // Simulate upload completion
      await waitFor(() => {
        expect(screen.getByText('test.pdf')).toBeInTheDocument();
      });

      // Download attachment
      const downloadButton = screen.getByText('Download');
      await user.click(downloadButton);

      // Delete attachment
      const deleteButton = screen.getByText('Delete');
      await user.click(deleteButton);

      expect(mockStrandsApi.deleteAttachment).toHaveBeenCalledWith('att-1');
    });
  });

  describe('Sync Workflow with Progress Tracking', () => {
    it('syncs a strand and shows progress modal', async () => {
      renderStrandsApp('/strands/strand-1');

      await waitFor(() => {
        expect(screen.getByTestId('strand-detail')).toBeInTheDocument();
      });

      // Mock sync progress
      const progressCallback = jest.fn();
      mockSyncService.syncStrand.mockImplementation(() => {
        progressCallback({
          current: 1,
          total: 3,
          message: 'Processing...',
          status: 'processing',
        });
        return Promise.resolve({ success: true, logId: 'log-123' });
      });

      // Trigger sync (need to find sync button in mocked detail)
      // Since detail is mocked, we'll assume there's a sync button
      const syncButton = screen.getByRole('button', { name: 'Sync' });
      await user.click(syncButton);

      // Verify sync service called
      expect(mockSyncService.syncStrand).toHaveBeenCalledWith('strand-1');

      // Progress modal should appear
      await waitFor(() => {
        expect(screen.getByTestId('sync-progress-modal')).toBeInTheDocument();
      });
    });

    it('cancels sync during operation', async () => {
      renderStrandsApp('/strands/strand-1');

      await waitFor(() => {
        expect(screen.getByTestId('strand-detail')).toBeInTheDocument();
      });

      // Mock a never-resolving sync
      mockSyncService.syncStrand.mockReturnValue(new Promise(() => {}));

      // Start sync
      const syncButton = screen.getByRole('button', { name: 'Sync' });
      await user.click(syncButton);

      // Cancel sync
      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await user.click(cancelButton);

      expect(mockSyncService.cancel).toHaveBeenCalled();
    });
  });

  describe('Tag Filtering and Search Workflow', () => {
    it('filters strands by tags and searches', async () => {
      renderStrandsApp();

      await waitFor(() => {
        expect(screen.getByTestId('tag-filter')).toBeInTheDocument();
      });

      // Toggle a tag
      const tagButton = screen.getByTestId('tag-meeting');
      await user.click(tagButton);

      // Verify API called with tag filter
      expect(mockStrandsApi.getStrands).toHaveBeenCalledWith({ tag: 'meeting' });

      // Clear filter
      const clearButton = screen.getByRole('button', { name: 'Clear filter' });
      await user.click(clearButton);

      // Search
      const searchInput = screen.getByPlaceholderText('Search strands...');
      await user.type(searchInput, 'important');

      expect(mockStrandsApi.getStrands).toHaveBeenCalledWith({ search: 'important' });
    });
  });

  describe('Error Recovery Workflow', () => {
    it('handles API errors and allows retry', async () => {
      // Mock initial failure
      mockStrandsApi.createStrand.mockRejectedValueOnce(new Error('Network error'));
      mockStrandsApi.createStrand.mockResolvedValueOnce({
        strand: {
          id: 'recovered',
          title: 'Recovered Strand',
          content: 'Content',
          tags: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          userId: 'user-1',
          syncStatus: 'pending',
        },
      });

      renderStrandsApp();

      // Try to create strand
      const createButton = screen.getByRole('button', { name: 'New Strand' });
      await user.click(createButton);
      await user.type(screen.getByLabelText('Title'), 'Error Test');
      const submitButton = screen.getByRole('button', { name: 'Create Strand' });
      await user.click(submitButton);

      // Error should be shown (UI may display toast)
      // Retry (simulate user clicking retry button)
      const retryButton = screen.getByRole('button', { name: 'Retry' });
      await user.click(retryButton);

      // Verify second attempt succeeds
      await waitFor(() => {
        expect(mockStrandsApi.createStrand).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Bulk Operations Workflow', () => {
    it('selects multiple strands and performs bulk actions', async () => {
      renderStrandsApp();

      await waitFor(() => {
        expect(screen.getByText('Strands')).toBeInTheDocument();
      });

      // Enable selection mode
      const selectModeButton = screen.getByRole('button', { name: 'Select' });
      await user.click(selectModeButton);

      // Select two strands (mocked cards)
      const card1 = screen.getByTestId('strand-card-strand-1');
      const card2 = screen.getByTestId('strand-card-strand-2');
      const selectButton1 = within(card1).getByText('Select');
      const selectButton2 = within(card2).getByText('Select');
      await user.click(selectButton1);
      await user.click(selectButton2);

      // Verify selection count
      expect(screen.getByText('2 selected')).toBeInTheDocument();

      // Perform bulk delete
      const bulkDeleteButton = screen.getByRole('button', { name: 'Delete Selected' });
      await user.click(bulkDeleteButton);

      // Confirm deletion
      const confirmButton = screen.getByRole('button', { name: 'Confirm' });
      await user.click(confirmButton);

      // Verify delete calls
      expect(mockStrandsApi.deleteStrand).toHaveBeenCalledWith('strand-1');
      expect(mockStrandsApi.deleteStrand).toHaveBeenCalledWith('strand-2');
    });
  });
});
