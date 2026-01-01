/**
 * Tests for StrandDetail component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StrandDetail from '@/features/strands/components/StrandDetail';
import { renderWithProviders, setupTest } from '@/shared/fixtures/testUtils';
import { mockStrands } from '@/shared/fixtures/mockData';

// Mock hooks and services
jest.mock('@/features/strands/hooks/strands.hooks', () => ({
  useStrand: jest.fn(),
  useUpdateStrand: jest.fn(),
  useDeleteStrand: jest.fn(),
}));

jest.mock('@/features/strands/api/strands.api', () => ({
  StrandsApi: {
    rollbackStrand: jest.fn(),
    uploadFiles: jest.fn(),
    deleteAttachment: jest.fn(),
  },
}));

jest.mock('@/features/strands/services/syncService', () => ({
  syncService: {
    syncSingle: jest.fn(),
    cancel: jest.fn(),
  },
}));

// Mock child components
jest.mock('@/features/strands/components/TagChip', () => ({
  __esModule: true,
  default: ({ tag, removable, onRemove }: any) => {
    const React = require('react');
    const children = [tag];
    if (removable) {
      children.push(React.createElement('button', { onClick: () => onRemove?.(tag) }, 'Remove'));
    }
    return React.createElement('div', { 'data-testid': `tag-chip-${tag}` }, children);
  },
}));

jest.mock('@/features/strands/components/SyncLogViewer', () => ({
  __esModule: true,
  default: ({ syncHistory, onRollback }: any) => {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'sync-log-viewer' },
      React.createElement('div', null, 'Sync History (', syncHistory.length, ')'),
      React.createElement('button', { onClick: () => onRollback?.(syncHistory[0]) }, 'Rollback')
    );
  },
}));

jest.mock('@/features/strands/components/ConfirmDialog', () => ({
  __esModule: true,
  default: ({ isOpen, title, message, onConfirm, onCancel }: any) => {
    const React = require('react');
    return isOpen ? React.createElement('div', { 'data-testid': 'confirm-dialog' },
      React.createElement('h3', null, title),
      React.createElement('p', null, message),
      React.createElement('button', { onClick: onConfirm }, 'Confirm'),
      React.createElement('button', { onClick: onCancel }, 'Cancel')
    ) : null;
  },
}));

jest.mock('@/features/strands/components/FileUpload', () => ({
  __esModule: true,
  default: ({ onFilesSelected, disabled }: any) => {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'file-upload' },
      React.createElement('button', { onClick: () => onFilesSelected?.([new File([''], 'test.txt')]), disabled: disabled }, 'Upload')
    );
  },
}));

jest.mock('@/features/strands/components/UploadProgress', () => ({
  __esModule: true,
  default: ({ uploads, onCancel }: any) => {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'upload-progress' },
      uploads.map((upload: any) =>
        React.createElement('div', { key: upload.fileName },
          upload.fileName, ' - ', upload.status,
          React.createElement('button', { onClick: () => onCancel?.(upload.fileName) }, 'Cancel')
        )
      )
    );
  },
}));

jest.mock('@/features/strands/components/AttachmentList', () => ({
  __esModule: true,
  default: ({ attachments, onDelete, disabled }: any) => {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'attachment-list' },
      attachments.map((att: any) =>
        React.createElement('div', { key: att.id },
          att.original_name,
          React.createElement('button', { onClick: () => onDelete?.(att.id), disabled: disabled }, 'Delete')
        )
      )
    );
  },
}));

jest.mock('@/shared/components/Dialog', () => ({
  __esModule: true,
  default: ({ isOpen, title, message, onConfirm, onCancel }: any) => {
    const React = require('react');
    return isOpen ? React.createElement('div', { 'data-testid': 'dialog' },
      React.createElement('h3', null, title),
      React.createElement('p', null, message),
      React.createElement('button', { onClick: onConfirm }, 'Confirm'),
      React.createElement('button', { onClick: onCancel }, 'Cancel')
    ) : null;
  },
}));

jest.mock('@/shared/components/Toast', () => ({
  __esModule: true,
  default: ({ isOpen, message, onClose }: any) => {
    const React = require('react');
    return isOpen ? React.createElement('div', { 'data-testid': 'toast' },
      React.createElement('span', null, message),
      React.createElement('button', { onClick: onClose }, 'Close')
    ) : null;
  },
}));

jest.mock('@/features/strands/components/SyncProgressModal', () => ({
  __esModule: true,
  default: ({ isOpen, progress, onClose, onCancel }: any) => {
    const React = require('react');
    return isOpen ? React.createElement('div', { 'data-testid': 'sync-progress-modal' },
      React.createElement('div', null, 'Progress: ', progress.status),
      React.createElement('button', { onClick: onClose }, 'Close'),
      React.createElement('button', { onClick: onCancel }, 'Cancel')
    ) : null;
  },
}));

describe('StrandDetail', () => {
  const { user } = setupTest();
  const mockUseStrand = require('@/features/strands/hooks/strands.hooks').useStrand;
  const mockUseUpdateStrand = require('@/features/strands/hooks/strands.hooks').useUpdateStrand;
  const mockUseDeleteStrand = require('@/features/strands/hooks/strands.hooks').useDeleteStrand;
  const mockStrandsApi = require('@/features/strands/api/strands.api').StrandsApi;
  const mockSyncService = require('@/features/strands/services/syncService').syncService;

  const strand = mockStrands[0];
  const defaultStrand = {
    strand,
    loading: false,
    error: null,
    refetch: jest.fn(),
  };

  const defaultUpdateStrand = {
    updateStrand: jest.fn().mockResolvedValue({ strand }),
    loading: false,
    error: null,
  };

  const defaultDeleteStrand = {
    deleteStrand: jest.fn().mockResolvedValue({}),
    loading: false,
    error: null,
  };

  beforeEach(() => {
    mockUseStrand.mockReturnValue(defaultStrand);
    mockUseUpdateStrand.mockReturnValue(defaultUpdateStrand);
    mockUseDeleteStrand.mockReturnValue(defaultDeleteStrand);
    mockStrandsApi.rollbackStrand.mockClear();
    mockStrandsApi.uploadFiles.mockClear();
    mockStrandsApi.deleteAttachment.mockClear();
    mockSyncService.syncSingle.mockClear();
    mockSyncService.cancel.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders loading state', () => {
      mockUseStrand.mockReturnValue({
        ...defaultStrand,
        loading: true,
      });

      renderWithProviders(<StrandDetail strandId={strand.id} onBack={jest.fn()} />);

      expect(screen.getByText('Loading strand...')).toBeInTheDocument();
    });

    it('renders error state', () => {
      mockUseStrand.mockReturnValue({
        ...defaultStrand,
        error: new Error('Failed to load'),
      });

      renderWithProviders(<StrandDetail strandId={strand.id} onBack={jest.fn()} />);

      expect(screen.getByText('Error loading strand. Please try again later.')).toBeInTheDocument();
      expect(screen.getByText('Go back')).toBeInTheDocument();
    });

    it('renders strand details when loaded', () => {
      renderWithProviders(<StrandDetail strandId={strand.id} onBack={jest.fn()} />);

      expect(screen.getByText('Back to Strands')).toBeInTheDocument();
      expect(screen.getByText('Details')).toBeInTheDocument();
      expect(screen.getByText('Sync History')).toBeInTheDocument();
      expect(screen.getByText(strand.summary || strand.content.substring(0, 50))).toBeInTheDocument();
      expect(screen.getByText('Edit')).toBeInTheDocument();
      expect(screen.getByText('Delete')).toBeInTheDocument();
      expect(screen.getByText('Sync')).toBeInTheDocument();
    });

    it('renders tags', () => {
      renderWithProviders(<StrandDetail strandId={strand.id} onBack={jest.fn()} />);

      strand.tags.forEach((tag) => {
        expect(screen.getByTestId(`tag-chip-${tag}`)).toBeInTheDocument();
      });
    });

    it('renders sync history tab', async () => {
      renderWithProviders(<StrandDetail strandId={strand.id} onBack={jest.fn()} />);

      const syncHistoryTab = screen.getByText('Sync History');
      await user.click(syncHistoryTab);

      expect(screen.getByTestId('sync-log-viewer')).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('calls onBack when back button is clicked', async () => {
      const onBack = jest.fn();
      renderWithProviders(<StrandDetail strandId={strand.id} onBack={onBack} />);

      const backButton = screen.getByText('Back to Strands');
      await user.click(backButton);

      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('calls onDeleted when strand is deleted and onDeleted prop provided', async () => {
      const onDeleted = jest.fn();
      renderWithProviders(<StrandDetail strandId={strand.id} onBack={jest.fn()} onDeleted={onDeleted} />);

      // Click delete button
      const deleteButton = screen.getByText('Delete');
      await user.click(deleteButton);

      // Confirm dialog appears
      expect(screen.getByTestId('dialog')).toBeInTheDocument();

      // Click confirm
      const confirmButton = screen.getByRole('button', { name: /Confirm/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(defaultDeleteStrand.deleteStrand).toHaveBeenCalledWith(strand.id);
        expect(onDeleted).toHaveBeenCalledTimes(1);
      });
    });

    it('calls onBack when strand is deleted and onDeleted not provided', async () => {
      const onBack = jest.fn();
      renderWithProviders(<StrandDetail strandId={strand.id} onBack={onBack} />);

      const deleteButton = screen.getByText('Delete');
      await user.click(deleteButton);

      const confirmButton = screen.getByRole('button', { name: /Confirm/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(onBack).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Editing', () => {
    it('enters edit mode when Edit button is clicked', async () => {
      renderWithProviders(<StrandDetail strandId={strand.id} onBack={jest.fn()} />);

      const editButton = screen.getByText('Edit');
      await user.click(editButton);

      expect(screen.getByRole('button', { name: /Save/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument();
      expect(screen.queryByText('Edit')).not.toBeInTheDocument();
      expect(screen.queryByText('Delete')).not.toBeInTheDocument();
      expect(screen.queryByText('Sync')).not.toBeInTheDocument();
    });

    it('cancels edit when Cancel button is clicked', async () => {
      renderWithProviders(<StrandDetail strandId={strand.id} onBack={jest.fn()} />);

      const editButton = screen.getByText('Edit');
      await user.click(editButton);

      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      await user.click(cancelButton);

      expect(screen.getByText('Edit')).toBeInTheDocument();
      expect(screen.getByText('Delete')).toBeInTheDocument();
    });

    it('saves edits when Save button is clicked', async () => {
      renderWithProviders(<StrandDetail strandId={strand.id} onBack={jest.fn()} />);

      const editButton = screen.getByText('Edit');
      await user.click(editButton);

      const textarea = screen.getByPlaceholderText('Enter strand content...');
      await user.clear(textarea);
      await user.type(textarea, 'Updated content');

      const saveButton = screen.getByRole('button', { name: /Save/i });
      await user.click(saveButton);

      expect(defaultUpdateStrand.updateStrand).toHaveBeenCalledWith(strand.id, {
        content: 'Updated content',
        tags: strand.tags,
      });
    });

    it('adds and removes tags in edit mode', async () => {
      renderWithProviders(<StrandDetail strandId={strand.id} onBack={jest.fn()} />);

      const editButton = screen.getByText('Edit');
      await user.click(editButton);

      // Add tag
      const tagInput = screen.getByPlaceholderText('Add a tag...');
      await user.type(tagInput, 'newtag');
      const addButton = screen.getByRole('button', { name: /Add/i });
      await user.click(addButton);

      // Remove tag
      const removeButtons = screen.getAllByRole('button', { name: /Remove/i });
      await user.click(removeButtons[0]);

      // Save
      const saveButton = screen.getByRole('button', { name: /Save/i });
      await user.click(saveButton);

      // Check that update was called with updated tags
      expect(defaultUpdateStrand.updateStrand).toHaveBeenCalled();
    });
  });

  describe('Sync Functionality', () => {
    it('initiates sync when Sync button is clicked', async () => {
      renderWithProviders(<StrandDetail strandId={strand.id} onBack={jest.fn()} />);

      const syncButton = screen.getByText('Sync');
      await user.click(syncButton);

      expect(mockSyncService.syncSingle).toHaveBeenCalledWith(strand, expect.any(Object));
    });

    it('shows sync progress modal during sync', async () => {
      mockSyncService.syncSingle.mockImplementation((strand, options) => {
        options.onProgress?.({
          total: 1,
          completed: 0,
          failed: 0,
          status: 'syncing',
          message: 'Syncing...',
        });
        return Promise.resolve();
      });

      renderWithProviders(<StrandDetail strandId={strand.id} onBack={jest.fn()} />);

      const syncButton = screen.getByText('Sync');
      await user.click(syncButton);

      await waitFor(() => {
        expect(screen.getByTestId('sync-progress-modal')).toBeInTheDocument();
      });
    });

    it('refetches strand after successful sync', async () => {
      mockSyncService.syncSingle.mockResolvedValue({});

      renderWithProviders(<StrandDetail strandId={strand.id} onBack={jest.fn()} />);

      const syncButton = screen.getByText('Sync');
      await user.click(syncButton);

      await waitFor(() => {
        expect(defaultStrand.refetch).toHaveBeenCalled();
      });
    });
  });

  describe('Rollback', () => {
    it('shows rollback confirmation when rollback is requested', async () => {
      renderWithProviders(<StrandDetail strandId={strand.id} onBack={jest.fn()} />);

      // Switch to sync history tab
      const syncHistoryTab = screen.getByText('Sync History');
      await user.click(syncHistoryTab);

      // Click rollback button
      const rollbackButton = screen.getByRole('button', { name: /Rollback/i });
      await user.click(rollbackButton);

      expect(screen.getByTestId('dialog')).toBeInTheDocument();
      expect(screen.getByText('Restore Version')).toBeInTheDocument();
    });

    it('performs rollback when confirmed', async () => {
      renderWithProviders(<StrandDetail strandId={strand.id} onBack={jest.fn()} />);

      // Switch to sync history tab
      const syncHistoryTab = screen.getByText('Sync History');
      await user.click(syncHistoryTab);

      // Click rollback button
      const rollbackButton = screen.getByRole('button', { name: /Rollback/i });
      await user.click(rollbackButton);

      // Confirm
      const confirmButton = screen.getByRole('button', { name: /Confirm/i });
      await user.click(confirmButton);

      expect(mockStrandsApi.rollbackStrand).toHaveBeenCalledWith(
        strand.id,
        strand.sync_history[0].timestamp
      );
    });

    it('shows success toast after rollback', async () => {
      mockStrandsApi.rollbackStrand.mockResolvedValue({ strand });

      renderWithProviders(<StrandDetail strandId={strand.id} onBack={jest.fn()} />);

      // Switch to sync history tab
      const syncHistoryTab = screen.getByText('Sync History');
      await user.click(syncHistoryTab);

      // Click rollback button
      const rollbackButton = screen.getByRole('button', { name: /Rollback/i });
      await user.click(rollbackButton);

      // Confirm
      const confirmButton = screen.getByRole('button', { name: /Confirm/i });
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByTestId('toast')).toBeInTheDocument();
        expect(screen.getByText('Successfully restored to previous version.')).toBeInTheDocument();
      });
    });
  });

  describe('File Upload', () => {
    it('uploads files when file upload is triggered', async () => {
      mockStrandsApi.uploadFiles.mockResolvedValue([]);

      renderWithProviders(<StrandDetail strandId={strand.id} onBack={jest.fn()} />);

      // Trigger file upload via mocked component
      const uploadButton = screen.getByTestId('file-upload').querySelector('button');
      await user.click(uploadButton!);

      expect(mockStrandsApi.uploadFiles).toHaveBeenCalledWith(strand.id, expect.any(Array));
    });

    it('shows upload progress during upload', async () => {
      mockStrandsApi.uploadFiles.mockImplementation(() => new Promise(() => {})); // Never resolves

      renderWithProviders(<StrandDetail strandId={strand.id} onBack={jest.fn()} />);

      const uploadButton = screen.getByTestId('file-upload').querySelector('button');
      await user.click(uploadButton!);

      expect(screen.getByTestId('upload-progress')).toBeInTheDocument();
    });

    it('cancels upload when cancel button is clicked', async () => {
      let cancelUpload: () => void;
      mockStrandsApi.uploadFiles.mockImplementation(() => new Promise((_, reject) => {
        cancelUpload = () => reject(new Error('Cancelled'));
      }));

      renderWithProviders(<StrandDetail strandId={strand.id} onBack={jest.fn()} />);

      const uploadButton = screen.getByTestId('file-upload').querySelector('button');
      await user.click(uploadButton!);

      const cancelButton = screen.getByTestId('upload-progress').querySelector('button');
      await user.click(cancelButton!);

      // Expect upload to be cancelled
      expect(mockStrandsApi.uploadFiles).toHaveBeenCalled();
    });
  });
});
