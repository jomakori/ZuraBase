/**
 * Tests for SyncProgressModal component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SyncProgressModal, { SyncProgress } from '@/features/strands/components/SyncProgressModal';
import { renderWithProviders, setupTest } from '@/shared/fixtures/testUtils';

describe('SyncProgressModal', () => {
  const { user } = setupTest();

  const defaultProps = {
    isOpen: true,
    onClose: jest.fn(),
    onCancel: jest.fn(),
    progress: null as SyncProgress | null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders nothing when isOpen is false', () => {
      renderWithProviders(<SyncProgressModal {...defaultProps} isOpen={false} />);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders modal with title and description when open', () => {
      const progress: SyncProgress = {
        completed: 0,
        total: 5,
        failed: 0,
        status: 'syncing',
      };
      renderWithProviders(<SyncProgressModal {...defaultProps} progress={progress} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Syncing Strands')).toBeInTheDocument();
    });

    it('renders progress bar when progress is provided', () => {
      const progress: SyncProgress = {
        completed: 2,
        total: 5,
        failed: 0,
        message: 'Processing strand 2 of 5',
        status: 'syncing',
      };
      renderWithProviders(<SyncProgressModal {...defaultProps} progress={progress} />);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByText('2 of 5 strands processed')).toBeInTheDocument();
    });

    it('renders indeterminate progress bar when progress is null', () => {
      renderWithProviders(<SyncProgressModal {...defaultProps} />);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toBeInTheDocument();
      expect(progressBar).toHaveAttribute('aria-valuenow', '0');
    });

    it('renders cancel button', () => {
      renderWithProviders(<SyncProgressModal {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'Cancel Sync' })).toBeInTheDocument();
    });

    it('does not render close button (X)', () => {
      renderWithProviders(<SyncProgressModal {...defaultProps} />);

      expect(screen.queryByRole('button', { name: /close/i })).not.toBeInTheDocument();
    });
  });

  describe('Progress Display', () => {
    it('calculates correct percentage', () => {
      const progress: SyncProgress = {
        completed: 3,
        total: 10,
        failed: 0,
        message: 'Processing',
        status: 'syncing',
      };
      renderWithProviders(<SyncProgressModal {...defaultProps} progress={progress} />);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '30');
      expect(progressBar).toHaveAttribute('aria-valuemax', '100');
    });

    it('handles zero total gracefully', () => {
      const progress: SyncProgress = {
        completed: 0,
        total: 0,
        failed: 0,
        message: 'Starting',
        status: 'syncing',
      };
      renderWithProviders(<SyncProgressModal {...defaultProps} progress={progress} />);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '0');
    });

    it('displays status messages', () => {
      const progress: SyncProgress = {
        completed: 1,
        total: 3,
        failed: 0,
        message: 'Analyzing content with AI',
        status: 'syncing',
      };
      renderWithProviders(<SyncProgressModal {...defaultProps} progress={progress} />);

      expect(screen.getByText('Analyzing content with AI')).toBeInTheDocument();
    });

    it('updates progress when prop changes', () => {
      const initialProgress: SyncProgress = {
        completed: 0,
        total: 8,
        failed: 0,
        status: 'syncing',
      };
      const { rerender } = renderWithProviders(<SyncProgressModal {...defaultProps} progress={initialProgress} />);

      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');

      const newProgress: SyncProgress = {
        completed: 5,
        total: 8,
        failed: 0,
        message: 'Updated',
        status: 'syncing',
      };
      rerender(<SyncProgressModal {...defaultProps} progress={newProgress} />);

      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '63');
    });
  });

  describe('User Interactions', () => {
    it('calls onCancel when cancel button is clicked', async () => {
      renderWithProviders(<SyncProgressModal {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: 'Cancel Sync' });
      await user.click(cancelButton);

      expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when modal backdrop is clicked', async () => {
      renderWithProviders(<SyncProgressModal {...defaultProps} />);

      const backdrop = screen.getByRole('dialog').parentElement!;
      await user.click(backdrop);

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose when modal content is clicked', async () => {
      renderWithProviders(<SyncProgressModal {...defaultProps} />);

      const modalContent = screen.getByText('Syncing Strands');
      await user.click(modalContent);

      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });

    it('calls onClose when Escape key is pressed', async () => {
      renderWithProviders(<SyncProgressModal {...defaultProps} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose when other keys are pressed', async () => {
      renderWithProviders(<SyncProgressModal {...defaultProps} />);

      fireEvent.keyDown(document, { key: 'Enter' });

      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      renderWithProviders(<SyncProgressModal {...defaultProps} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby');
      expect(dialog).toHaveAttribute('aria-describedby');
    });

    it('sets focus on cancel button when opened', () => {
      renderWithProviders(<SyncProgressModal {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: 'Cancel Sync' });
      expect(cancelButton).toHaveFocus();
    });

    it('traps focus within modal', async () => {
      renderWithProviders(<SyncProgressModal {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: 'Cancel Sync' });
      expect(cancelButton).toHaveFocus();

      // Press Tab
      fireEvent.keyDown(cancelButton, { key: 'Tab' });
      // Should stay within modal (only one focusable element)
      expect(cancelButton).toHaveFocus();
    });
  });

  describe('Edge Cases', () => {
    it('handles progress with completed > total', () => {
      const progress: SyncProgress = {
        completed: 10,
        total: 5,
        failed: 0,
        message: 'Overflow',
        status: 'syncing',
      };
      renderWithProviders(<SyncProgressModal {...defaultProps} progress={progress} />);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '100');
    });

    it('handles zero completed', () => {
      const progress: SyncProgress = {
        completed: 0,
        total: 5,
        failed: 0,
        message: 'Starting',
        status: 'syncing',
      };
      renderWithProviders(<SyncProgressModal {...defaultProps} progress={progress} />);

      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '0');
    });

    it('renders with progress prop', () => {
      const progress: SyncProgress = {
        completed: 1,
        total: 5,
        failed: 0,
        status: 'syncing',
      };
      renderWithProviders(<SyncProgressModal {...defaultProps} progress={progress} />);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('does not call onCancel when component unmounts', () => {
      const { unmount } = renderWithProviders(<SyncProgressModal {...defaultProps} />);

      unmount();

      expect(defaultProps.onCancel).not.toHaveBeenCalled();
    });
  });

  describe('Integration with Sync Service', () => {
    it('displays error status when progress status is error', () => {
      const progress: SyncProgress = {
        completed: 2,
        total: 5,
        failed: 1,
        message: 'Failed to process strand',
        status: 'error',
      };
      renderWithProviders(<SyncProgressModal {...defaultProps} progress={progress} />);

      expect(screen.getByText('Failed to process strand')).toBeInTheDocument();
    });

    it('displays completed status when progress status is completed', () => {
      const progress: SyncProgress = {
        completed: 5,
        total: 5,
        failed: 0,
        message: 'Sync completed successfully',
        status: 'completed',
      };
      renderWithProviders(<SyncProgressModal {...defaultProps} progress={progress} />);

      expect(screen.getByText('Sync completed successfully')).toBeInTheDocument();
      expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
    });
  });
});
