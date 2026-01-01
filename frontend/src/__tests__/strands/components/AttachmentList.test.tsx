/**
 * Tests for AttachmentList component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AttachmentList from '@/features/strands/components/AttachmentList';
import { renderWithProviders, setupTest } from '@/shared/fixtures/testUtils';
import { FileAttachment } from '@/features/strands/types';

describe('AttachmentList', () => {
  const { user } = setupTest();

  const mockAttachments: FileAttachment[] = [
    {
      id: '1',
      filename: 'document.pdf',
      url: '/uploads/document.pdf',
      size: 1024 * 1024, // 1 MB
      mimeType: 'application/pdf',
      uploadedAt: '2025-12-31T10:00:00Z',
    },
    {
      id: '2',
      filename: 'image.jpg',
      url: '/uploads/image.jpg',
      size: 500 * 1024, // 500 KB
      mimeType: 'image/jpeg',
      uploadedAt: '2025-12-31T10:05:00Z',
    },
    {
      id: '3',
      filename: 'video.mp4',
      url: '/uploads/video.mp4',
      size: 50 * 1024 * 1024, // 50 MB
      mimeType: 'video/mp4',
      uploadedAt: '2025-12-31T10:10:00Z',
    },
    {
      id: '4',
      filename: 'notes.txt',
      url: '/uploads/notes.txt',
      size: 1024, // 1 KB
      mimeType: 'text/plain',
      uploadedAt: '2025-12-31T10:15:00Z',
    },
  ];

  const defaultProps = {
    attachments: mockAttachments,
    onDownload: jest.fn(),
    onDelete: jest.fn(),
    onPreview: jest.fn(),
    canDelete: true,
    isLoading: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders component with title and count', () => {
      renderWithProviders(<AttachmentList {...defaultProps} />);

      expect(screen.getByText('Attachments')).toBeInTheDocument();
      expect(screen.getByText('4 files')).toBeInTheDocument();
    });

    it('renders empty state when no attachments', () => {
      renderWithProviders(<AttachmentList {...defaultProps} attachments={[]} />);

      expect(screen.getByText('No attachments')).toBeInTheDocument();
      expect(screen.getByText('Upload files to attach them to this strand')).toBeInTheDocument();
    });

    it('renders all attachment items', () => {
      renderWithProviders(<AttachmentList {...defaultProps} />);

      expect(screen.getByText('document.pdf')).toBeInTheDocument();
      expect(screen.getByText('image.jpg')).toBeInTheDocument();
      expect(screen.getByText('video.mp4')).toBeInTheDocument();
      expect(screen.getByText('notes.txt')).toBeInTheDocument();
    });

    it('renders file icons based on mime type', () => {
      renderWithProviders(<AttachmentList {...defaultProps} />);

      // Should have appropriate icons
      const pdfIcon = screen.getByLabelText('PDF document');
      expect(pdfIcon).toBeInTheDocument();

      const imageIcon = screen.getByLabelText('Image');
      expect(imageIcon).toBeInTheDocument();

      const videoIcon = screen.getByLabelText('Video');
      expect(videoIcon).toBeInTheDocument();

      const textIcon = screen.getByLabelText('Text document');
      expect(textIcon).toBeInTheDocument();
    });

    it('renders formatted file sizes', () => {
      renderWithProviders(<AttachmentList {...defaultProps} />);

      expect(screen.getByText('1 MB')).toBeInTheDocument();
      expect(screen.getByText('500 KB')).toBeInTheDocument();
      expect(screen.getByText('50 MB')).toBeInTheDocument();
      expect(screen.getByText('1 KB')).toBeInTheDocument();
    });

    it('renders formatted upload dates', () => {
      renderWithProviders(<AttachmentList {...defaultProps} />);

      expect(screen.getByText('10:00 AM')).toBeInTheDocument();
      expect(screen.getByText('10:05 AM')).toBeInTheDocument();
    });

    it('renders action buttons for each attachment', () => {
      renderWithProviders(<AttachmentList {...defaultProps} />);

      const downloadButtons = screen.getAllByRole('button', { name: 'Download' });
      expect(downloadButtons).toHaveLength(mockAttachments.length);

      const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
      expect(deleteButtons).toHaveLength(mockAttachments.length);

      const previewButtons = screen.getAllByRole('button', { name: 'Preview' });
      expect(previewButtons).toHaveLength(mockAttachments.length);
    });

    it('hides delete buttons when canDelete is false', () => {
      renderWithProviders(<AttachmentList {...defaultProps} canDelete={false} />);

      expect(screen.queryAllByRole('button', { name: 'Delete' })).toHaveLength(0);
    });

    it('shows loading skeleton when isLoading is true', () => {
      renderWithProviders(<AttachmentList {...defaultProps} isLoading={true} />);

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Loading attachments...')).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('calls onDownload when download button is clicked', async () => {
      renderWithProviders(<AttachmentList {...defaultProps} />);

      const downloadButtons = screen.getAllByRole('button', { name: 'Download' });
      await user.click(downloadButtons[0]);

      expect(defaultProps.onDownload).toHaveBeenCalledWith(mockAttachments[0]);
    });

    it('calls onDelete when delete button is clicked with confirmation', async () => {
      window.confirm = jest.fn(() => true);
      renderWithProviders(<AttachmentList {...defaultProps} />);

      const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
      await user.click(deleteButtons[1]);

      expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to delete image.jpg?');
      expect(defaultProps.onDelete).toHaveBeenCalledWith(mockAttachments[1]);
    });

    it('does not call onDelete if confirmation is cancelled', async () => {
      window.confirm = jest.fn(() => false);
      renderWithProviders(<AttachmentList {...defaultProps} />);

      const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
      await user.click(deleteButtons[0]);

      expect(window.confirm).toHaveBeenCalled();
      expect(defaultProps.onDelete).not.toHaveBeenCalled();
    });

    it('calls onPreview when preview button is clicked', async () => {
      renderWithProviders(<AttachmentList {...defaultProps} />);

      const previewButtons = screen.getAllByRole('button', { name: 'Preview' });
      await user.click(previewButtons[2]);

      expect(defaultProps.onPreview).toHaveBeenCalledWith(mockAttachments[2]);
    });

    it('calls onPreview when attachment name is clicked', async () => {
      renderWithProviders(<AttachmentList {...defaultProps} />);

      const attachmentName = screen.getByText('document.pdf');
      await user.click(attachmentName);

      expect(defaultProps.onPreview).toHaveBeenCalledWith(mockAttachments[0]);
    });

    it('opens file in new tab when download button is clicked with Ctrl key', async () => {
      const originalOpen = window.open;
      window.open = jest.fn();
      renderWithProviders(<AttachmentList {...defaultProps} />);

      const downloadButtons = screen.getAllByRole('button', { name: 'Download' });
      fireEvent.click(downloadButtons[0], { ctrlKey: true });

      expect(window.open).toHaveBeenCalledWith('/uploads/document.pdf', '_blank');
      window.open = originalOpen;
    });

    it('shows context menu on right click', async () => {
      renderWithProviders(<AttachmentList {...defaultProps} />);

      const attachmentItem = screen.getByText('document.pdf').closest('li');
      fireEvent.contextMenu(attachmentItem!);

      expect(screen.getByText('Copy link')).toBeInTheDocument();
      expect(screen.getByText('Rename')).toBeInTheDocument();
      expect(screen.getByText('Properties')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels for interactive elements', () => {
      renderWithProviders(<AttachmentList {...defaultProps} />);

      const downloadButtons = screen.getAllByRole('button', { name: 'Download' });
      expect(downloadButtons[0]).toHaveAttribute('aria-label', 'Download document.pdf');

      const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
      expect(deleteButtons[0]).toHaveAttribute('aria-label', 'Delete document.pdf');

      const previewButtons = screen.getAllByRole('button', { name: 'Preview' });
      expect(previewButtons[0]).toHaveAttribute('aria-label', 'Preview document.pdf');
    });

    it('lists attachments in a list with proper roles', () => {
      renderWithProviders(<AttachmentList {...defaultProps} />);

      expect(screen.getByRole('list')).toBeInTheDocument();
      expect(screen.getAllByRole('listitem')).toHaveLength(mockAttachments.length);
    });

    it('loading state announces to screen readers', () => {
      renderWithProviders(<AttachmentList {...defaultProps} isLoading={true} />);

      const statusRegion = screen.getByRole('status');
      expect(statusRegion).toHaveAttribute('aria-live', 'polite');
      expect(statusRegion).toHaveTextContent('Loading attachments');
    });
  });

  describe('Edge Cases', () => {
    it('handles attachments with missing fields', () => {
      const incompleteAttachments: FileAttachment[] = [
        {
          id: '5',
          filename: '',
          url: '',
          size: 0,
          mimeType: '',
          uploadedAt: '',
        },
      ];
      renderWithProviders(<AttachmentList {...defaultProps} attachments={incompleteAttachments} />);

      // Should still render without crashing
      expect(screen.getByText('Unknown file')).toBeInTheDocument();
      expect(screen.getByText('0 B')).toBeInTheDocument();
    });

    it('handles very long filenames with truncation', () => {
      const longFilename = 'a'.repeat(100) + '.pdf';
      const longAttachment: FileAttachment[] = [
        {
          id: '6',
          filename: longFilename,
          url: '/uploads/long.pdf',
          size: 1024,
          mimeType: 'application/pdf',
          uploadedAt: '2025-12-31T10:20:00Z',
        },
      ];
      renderWithProviders(<AttachmentList {...defaultProps} attachments={longAttachment} />);

      // Filename should be truncated with ellipsis
      const truncated = screen.getByText(longFilename.substring(0, 50) + '...');
      expect(truncated).toBeInTheDocument();
    });

    it('handles unsupported mime types with generic icon', () => {
      const unknownAttachment: FileAttachment[] = [
        {
          id: '7',
          filename: 'unknown.xyz',
          url: '/uploads/unknown.xyz',
          size: 1024,
          mimeType: 'application/x-unknown',
          uploadedAt: '2025-12-31T10:25:00Z',
        },
      ];
      renderWithProviders(<AttachmentList {...defaultProps} attachments={unknownAttachment} />);

      expect(screen.getByLabelText('File')).toBeInTheDocument();
    });

    it('updates when attachments prop changes', () => {
      const { rerender } = renderWithProviders(<AttachmentList {...defaultProps} attachments={[]} />);

      expect(screen.getByText('No attachments')).toBeInTheDocument();

      rerender(<AttachmentList {...defaultProps} attachments={mockAttachments.slice(0, 1)} />);

      expect(screen.getByText('document.pdf')).toBeInTheDocument();
      expect(screen.queryByText('No attachments')).not.toBeInTheDocument();
    });

    it('handles large number of attachments with virtualization', () => {
      const manyAttachments = Array.from({ length: 100 }, (_, i) => ({
        id: `att-${i}`,
        filename: `file-${i}.txt`,
        url: `/uploads/file-${i}.txt`,
        size: 1024 * i,
        mimeType: 'text/plain',
        uploadedAt: '2025-12-31T10:00:00Z',
      }));
      renderWithProviders(<AttachmentList {...defaultProps} attachments={manyAttachments} />);

      // Should render a subset (virtualized) or all
      expect(screen.getAllByRole('listitem')).toHaveLength(Math.min(manyAttachments.length, 20)); // Assuming page size
    });
  });

  describe('File Type Detection', () => {
    const testCases = [
      { mimeType: 'application/pdf', expectedLabel: 'PDF document' },
      { mimeType: 'image/jpeg', expectedLabel: 'Image' },
      { mimeType: 'image/png', expectedLabel: 'Image' },
      { mimeType: 'image/gif', expectedLabel: 'Image' },
      { mimeType: 'video/mp4', expectedLabel: 'Video' },
      { mimeType: 'video/quicktime', expectedLabel: 'Video' },
      { mimeType: 'audio/mpeg', expectedLabel: 'Audio' },
      { mimeType: 'text/plain', expectedLabel: 'Text document' },
      { mimeType: 'text/csv', expectedLabel: 'Text document' },
      { mimeType: 'application/msword', expectedLabel: 'Document' },
      { mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', expectedLabel: 'Document' },
      { mimeType: 'application/zip', expectedLabel: 'Archive' },
      { mimeType: 'application/x-unknown', expectedLabel: 'File' },
    ];

    testCases.forEach(({ mimeType, expectedLabel }) => {
      it(`detects ${mimeType} as ${expectedLabel}`, () => {
        const attachment: FileAttachment[] = [
          {
            id: 'test',
            filename: `test.${mimeType.split('/')[1]}`,
            url: '/uploads/test',
            size: 1024,
            mimeType,
            uploadedAt: '2025-12-31T10:00:00Z',
          },
        ];
        renderWithProviders(<AttachmentList {...defaultProps} attachments={attachment} />);

        expect(screen.getByLabelText(expectedLabel)).toBeInTheDocument();
      });
    });
  });

  describe('Integration with File Upload', () => {
    it('shows upload progress for pending attachments', () => {
      const pendingAttachments: FileAttachment[] = [
        {
          id: 'pending-1',
          filename: 'uploading.pdf',
          url: '',
          size: 1024,
          mimeType: 'application/pdf',
          uploadedAt: '2025-12-31T10:30:00Z',
          uploadProgress: 75,
        },
      ];
      renderWithProviders(<AttachmentList {...defaultProps} attachments={pendingAttachments} />);

      expect(screen.getByRole('progressbar')).toBeInTheDocument();
      expect(screen.getByText('75%')).toBeInTheDocument();
      expect(screen.getByText('Uploading...')).toBeInTheDocument();
    });

    it('disables actions for pending attachments', () => {
      const pendingAttachments: FileAttachment[] = [
        {
          id: 'pending-2',
          filename: 'uploading.jpg',
          url: '',
          size: 1024,
          mimeType: 'image/jpeg',
          uploadedAt: '2025-12-31T10:35:00Z',
          uploadProgress: 50,
        },
      ];
      renderWithProviders(<AttachmentList {...defaultProps} attachments={pendingAttachments} />);

      const downloadButton = screen.getByRole('button', { name: 'Download' });
      expect(downloadButton).toBeDisabled();

      const deleteButton = screen.getByRole('button', { name: 'Delete' });
      expect(deleteButton).toBeDisabled();
    });
  });
});
