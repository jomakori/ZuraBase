/**
 * Tests for SyncLogViewer component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SyncLogViewer from '@/features/strands/components/SyncLogViewer';
import { renderWithProviders, setupTest } from '@/shared/fixtures/testUtils';
import { SyncLog } from '@/features/strands/types';

describe('SyncLogViewer', () => {
  const { user } = setupTest();

  const mockLogs: SyncLog[] = [
    {
      id: '1',
      strandId: 'strand-1',
      timestamp: '2025-12-31T10:00:00Z',
      status: 'success',
      message: 'Strand processed successfully',
      details: { processedItems: 5 },
    },
    {
      id: '2',
      strandId: 'strand-2',
      timestamp: '2025-12-31T10:05:00Z',
      status: 'error',
      message: 'Failed to analyze content',
      details: { error: 'Network timeout' },
    },
    {
      id: '3',
      strandId: 'strand-3',
      timestamp: '2025-12-31T10:10:00Z',
      status: 'pending',
      message: 'Waiting for AI response',
      details: {},
    },
    {
      id: '4',
      strandId: 'strand-4',
      timestamp: '2025-12-31T10:15:00Z',
      status: 'success',
      message: 'Strand synced with external service',
      details: { service: 'WhatsApp', messageCount: 2 },
    },
  ];

  const defaultProps = {
    logs: mockLogs,
    isLoading: false,
    onRefresh: jest.fn(),
    onClear: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders component with title and controls', () => {
      renderWithProviders(<SyncLogViewer {...defaultProps} />);

      expect(screen.getByText('Sync Logs')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Clear Logs' })).toBeInTheDocument();
    });

    it('renders log table with headers', () => {
      renderWithProviders(<SyncLogViewer {...defaultProps} />);

      expect(screen.getByText('Time')).toBeInTheDocument();
      expect(screen.getByText('Status')).toBeInTheDocument();
      expect(screen.getByText('Message')).toBeInTheDocument();
      expect(screen.getByText('Details')).toBeInTheDocument();
    });

    it('renders all log entries', () => {
      renderWithProviders(<SyncLogViewer {...defaultProps} />);

      expect(screen.getByText('Strand processed successfully')).toBeInTheDocument();
      expect(screen.getByText('Failed to analyze content')).toBeInTheDocument();
      expect(screen.getByText('Waiting for AI response')).toBeInTheDocument();
      expect(screen.getByText('Strand synced with external service')).toBeInTheDocument();
    });

    it('renders status badges with appropriate colors', () => {
      renderWithProviders(<SyncLogViewer {...defaultProps} />);

      const successBadge = screen.getByText('success');
      expect(successBadge).toHaveClass('bg-green-100');
      expect(successBadge).toHaveClass('text-green-800');

      const errorBadge = screen.getByText('error');
      expect(errorBadge).toHaveClass('bg-red-100');
      expect(errorBadge).toHaveClass('text-red-800');

      const pendingBadge = screen.getByText('pending');
      expect(pendingBadge).toHaveClass('bg-yellow-100');
      expect(pendingBadge).toHaveClass('text-yellow-800');
    });

    it('renders formatted timestamps', () => {
      renderWithProviders(<SyncLogViewer {...defaultProps} />);

      // The component should format the timestamp
      expect(screen.getByText('10:00 AM')).toBeInTheDocument();
      expect(screen.getByText('10:05 AM')).toBeInTheDocument();
    });

    it('renders empty state when no logs', () => {
      renderWithProviders(<SyncLogViewer {...defaultProps} logs={[]} />);

      expect(screen.getByText('No sync logs available')).toBeInTheDocument();
    });

    it('shows loading spinner when isLoading is true', () => {
      renderWithProviders(<SyncLogViewer {...defaultProps} isLoading={true} />);

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Loading logs...')).toBeInTheDocument();
    });

    it('disables buttons when isLoading is true', () => {
      renderWithProviders(<SyncLogViewer {...defaultProps} isLoading={true} />);

      expect(screen.getByRole('button', { name: 'Refresh' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Clear Logs' })).toBeDisabled();
    });
  });

  describe('User Interactions', () => {
    it('calls onRefresh when refresh button is clicked', async () => {
      renderWithProviders(<SyncLogViewer {...defaultProps} />);

      const refreshButton = screen.getByRole('button', { name: 'Refresh' });
      await user.click(refreshButton);

      expect(defaultProps.onRefresh).toHaveBeenCalledTimes(1);
    });

    it('calls onClear when clear button is clicked', async () => {
      renderWithProviders(<SyncLogViewer {...defaultProps} />);

      const clearButton = screen.getByRole('button', { name: 'Clear Logs' });
      await user.click(clearButton);

      expect(defaultProps.onClear).toHaveBeenCalledTimes(1);
    });

    it('shows confirmation dialog before clearing logs', async () => {
      // The component may use a confirmation dialog; we'll assume it calls onClear directly
      // If there's a confirmation, we'd need to mock window.confirm
      window.confirm = jest.fn(() => true);
      renderWithProviders(<SyncLogViewer {...defaultProps} />);

      const clearButton = screen.getByRole('button', { name: 'Clear Logs' });
      await user.click(clearButton);

      expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to clear all sync logs?');
      expect(defaultProps.onClear).toHaveBeenCalledTimes(1);
    });

    it('does not call onClear if confirmation is cancelled', async () => {
      window.confirm = jest.fn(() => false);
      renderWithProviders(<SyncLogViewer {...defaultProps} />);

      const clearButton = screen.getByRole('button', { name: 'Clear Logs' });
      await user.click(clearButton);

      expect(window.confirm).toHaveBeenCalled();
      expect(defaultProps.onClear).not.toHaveBeenCalled();
    });

    it('expands and collapses log details when details button is clicked', async () => {
      renderWithProviders(<SyncLogViewer {...defaultProps} />);

      // Find the first details button (there should be one per row)
      const detailsButtons = screen.getAllByRole('button', { name: 'View Details' });
      expect(detailsButtons).toHaveLength(mockLogs.length);

      // Click first details button
      await user.click(detailsButtons[0]);

      // Should show details content
      expect(screen.getByText('processedItems')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();

      // Click again to collapse
      await user.click(detailsButtons[0]);
      expect(screen.queryByText('processedItems')).not.toBeInTheDocument();
    });

    it('filters logs by status when filter buttons are clicked', async () => {
      renderWithProviders(<SyncLogViewer {...defaultProps} />);

      // Assuming there are filter buttons for each status
      const successFilter = screen.getByRole('button', { name: 'Success' });
      await user.click(successFilter);

      // Should only show success logs
      expect(screen.getByText('Strand processed successfully')).toBeInTheDocument();
      expect(screen.getByText('Strand synced with external service')).toBeInTheDocument();
      expect(screen.queryByText('Failed to analyze content')).not.toBeInTheDocument();
      expect(screen.queryByText('Waiting for AI response')).not.toBeInTheDocument();
    });

    it('searches logs by message text', async () => {
      renderWithProviders(<SyncLogViewer {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText('Search logs...');
      await user.type(searchInput, 'analyze');

      // Should filter to logs containing "analyze"
      expect(screen.getByText('Failed to analyze content')).toBeInTheDocument();
      expect(screen.queryByText('Strand processed successfully')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels for interactive elements', () => {
      renderWithProviders(<SyncLogViewer {...defaultProps} />);

      const refreshButton = screen.getByRole('button', { name: 'Refresh' });
      expect(refreshButton).toHaveAttribute('aria-label', 'Refresh sync logs');

      const clearButton = screen.getByRole('button', { name: 'Clear Logs' });
      expect(clearButton).toHaveAttribute('aria-label', 'Clear all sync logs');
    });

    it('table has appropriate ARIA roles', () => {
      renderWithProviders(<SyncLogViewer {...defaultProps} />);

      expect(screen.getByRole('table')).toBeInTheDocument();
      expect(screen.getAllByRole('row')).toHaveLength(mockLogs.length + 1); // +1 for header row
      expect(screen.getAllByRole('columnheader')).toHaveLength(4);
    });

    it('loading state announces to screen readers', () => {
      renderWithProviders(<SyncLogViewer {...defaultProps} isLoading={true} />);

      const statusRegion = screen.getByRole('status');
      expect(statusRegion).toHaveAttribute('aria-live', 'polite');
      expect(statusRegion).toHaveTextContent('Loading logs');
    });
  });

  describe('Edge Cases', () => {
    it('handles logs with missing fields', () => {
      const incompleteLogs: SyncLog[] = [
        {
          id: '5',
          strandId: 'strand-5',
          timestamp: '',
          status: 'success',
          message: '',
          details: {},
        },
      ];
      renderWithProviders(<SyncLogViewer {...defaultProps} logs={incompleteLogs} />);

      // Should still render without crashing
      expect(screen.getByText('success')).toBeInTheDocument();
      expect(screen.getByText('—')).toBeInTheDocument(); // Empty timestamp placeholder
    });

    it('handles very long messages with truncation', () => {
      const longMessage = 'A'.repeat(200);
      const longLogs: SyncLog[] = [
        {
          id: '6',
          strandId: 'strand-6',
          timestamp: '2025-12-31T10:20:00Z',
          status: 'success',
          message: longMessage,
          details: {},
        },
      ];
      renderWithProviders(<SyncLogViewer {...defaultProps} logs={longLogs} />);

      // Message should be truncated with ellipsis
      const messageCell = screen.getByText(longMessage.substring(0, 100));
      expect(messageCell).toBeInTheDocument();
    });

    it('handles large number of logs with virtualization', () => {
      const manyLogs = Array.from({ length: 100 }, (_, i) => ({
        id: `log-${i}`,
        strandId: `strand-${i}`,
        timestamp: '2025-12-31T10:00:00Z',
        status: i % 2 === 0 ? 'success' : 'error',
        message: `Log entry ${i}`,
        details: {},
      }));
      renderWithProviders(<SyncLogViewer {...defaultProps} logs={manyLogs} />);

      // Should render a subset (virtualized) or all
      expect(screen.getAllByRole('row')).toHaveLength(Math.min(manyLogs.length, 20) + 1); // Assuming page size
    });

    it('updates when logs prop changes', () => {
      const { rerender } = renderWithProviders(<SyncLogViewer {...defaultProps} logs={[]} />);

      expect(screen.getByText('No sync logs available')).toBeInTheDocument();

      rerender(<SyncLogViewer {...defaultProps} logs={mockLogs.slice(0, 1)} />);

      expect(screen.getByText('Strand processed successfully')).toBeInTheDocument();
      expect(screen.queryByText('No sync logs available')).not.toBeInTheDocument();
    });
  });

  describe('Integration with Sync Service', () => {
    it('displays error logs with stack trace in details', () => {
      const errorLogs: SyncLog[] = [
        {
          id: '7',
          strandId: 'strand-7',
          timestamp: '2025-12-31T10:25:00Z',
          status: 'error',
          message: 'Runtime error',
          details: {
            error: 'TypeError: Cannot read property',
            stack: 'at processStrand (syncService.js:45:21)',
          },
        },
      ];
      renderWithProviders(<SyncLogViewer {...defaultProps} logs={errorLogs} />);

      const detailsButton = screen.getByRole('button', { name: 'View Details' });
      fireEvent.click(detailsButton);

      expect(screen.getByText('stack')).toBeInTheDocument();
      expect(screen.getByText('at processStrand (syncService.js:45:21)')).toBeInTheDocument();
    });

    it('formats details as JSON when details is an object', () => {
      renderWithProviders(<SyncLogViewer {...defaultProps} />);

      const detailsButtons = screen.getAllByRole('button', { name: 'View Details' });
      fireEvent.click(detailsButtons[0]);

      // Details should be displayed as formatted JSON
      expect(screen.getByText('"processedItems": 5')).toBeInTheDocument();
    });
  });
});
