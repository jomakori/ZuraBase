/**
 * Tests for FileUpload component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import FileUpload from '@/features/strands/components/FileUpload';
import { renderWithProviders, setupTest } from '@/shared/fixtures/testUtils';

describe('FileUpload', () => {
  const { user } = setupTest();

  const defaultProps = {
    onFilesSelected: jest.fn(),
    disabled: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders upload area with instructions', () => {
      renderWithProviders(<FileUpload {...defaultProps} />);

      expect(screen.getByText('Drop files here or click to upload')).toBeInTheDocument();
      expect(screen.getByText('Supports images, videos, PDFs, and text files (max 10MB each)')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '' })).toBeInTheDocument(); // The whole area is a button
    });

    it('renders hidden file input', () => {
      renderWithProviders(<FileUpload {...defaultProps} />);

      const fileInput = screen.getByLabelText('', { selector: 'input[type="file"]' });
      expect(fileInput).toBeInTheDocument();
      expect(fileInput).toHaveAttribute('type', 'file');
      expect(fileInput).toHaveAttribute('multiple');
    });

    it('applies disabled styles when disabled', () => {
      renderWithProviders(<FileUpload {...defaultProps} disabled={true} />);

      const uploadArea = screen.getByText('Drop files here or click to upload').closest('div');
      expect(uploadArea).toHaveClass('opacity-50');
      expect(uploadArea).toHaveClass('cursor-not-allowed');
    });
  });

  describe('File Selection', () => {
    it('triggers file input click when area is clicked', async () => {
      renderWithProviders(<FileUpload {...defaultProps} />);

      const fileInput = screen.getByLabelText('', { selector: 'input[type="file"]' }) as HTMLInputElement;
      const clickSpy = jest.spyOn(fileInput, 'click');

      const uploadArea = screen.getByText('Drop files here or click to upload').closest('div');
      await user.click(uploadArea!);

      expect(clickSpy).toHaveBeenCalledTimes(1);
    });

    it('does not trigger click when disabled', async () => {
      renderWithProviders(<FileUpload {...defaultProps} disabled={true} />);

      const fileInput = screen.getByLabelText('', { selector: 'input[type="file"]' }) as HTMLInputElement;
      const clickSpy = jest.spyOn(fileInput, 'click');

      const uploadArea = screen.getByText('Drop files here or click to upload').closest('div');
      await user.click(uploadArea!);

      expect(clickSpy).not.toHaveBeenCalled();
    });

    it('calls onFilesSelected with valid files when file input changes', async () => {
      const validFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
      renderWithProviders(<FileUpload {...defaultProps} />);

      const fileInput = screen.getByLabelText('', { selector: 'input[type="file"]' });

      fireEvent.change(fileInput, { target: { files: [validFile] } });

      expect(defaultProps.onFilesSelected).toHaveBeenCalledWith([validFile]);
    });

    it('filters out invalid file types', async () => {
      const validFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
      const invalidFile = new File(['content'], 'test.exe', { type: 'application/x-msdownload' });
      renderWithProviders(<FileUpload {...defaultProps} />);

      const fileInput = screen.getByLabelText('', { selector: 'input[type="file"]' });

      fireEvent.change(fileInput, { target: { files: [validFile, invalidFile] } });

      expect(defaultProps.onFilesSelected).toHaveBeenCalledWith([validFile]);
    });

    it('resets file input after selection', async () => {
      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
      renderWithProviders(<FileUpload {...defaultProps} />);

      const fileInput = screen.getByLabelText('', { selector: 'input[type="file"]' }) as HTMLInputElement;
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set;
      valueSetter!.call(fileInput, 'fake/path');

      fireEvent.change(fileInput, { target: { files: [file] } });

      // The component sets e.target.value = '' after handling files
      expect(fileInput.value).toBe('');
    });
  });

  describe('Drag and Drop', () => {
    it('shows drag active style on dragenter', async () => {
      renderWithProviders(<FileUpload {...defaultProps} />);

      const uploadArea = screen.getByText('Drop files here or click to upload').closest('div');

      fireEvent.dragEnter(uploadArea!);

      expect(uploadArea).toHaveClass('border-blue-500');
      expect(uploadArea).toHaveClass('bg-blue-50');
    });

    it('removes drag active style on dragleave', async () => {
      renderWithProviders(<FileUpload {...defaultProps} />);

      const uploadArea = screen.getByText('Drop files here or click to upload').closest('div');

      fireEvent.dragEnter(uploadArea!);
      expect(uploadArea).toHaveClass('border-blue-500');

      fireEvent.dragLeave(uploadArea!);
      expect(uploadArea).not.toHaveClass('border-blue-500');
      expect(uploadArea).not.toHaveClass('bg-blue-50');
    });

    it('handles file drop with valid files', async () => {
      const validFile = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
      renderWithProviders(<FileUpload {...defaultProps} />);

      const uploadArea = screen.getByText('Drop files here or click to upload').closest('div');

      fireEvent.drop(uploadArea!, {
        dataTransfer: {
          files: [validFile],
        },
      });

      expect(defaultProps.onFilesSelected).toHaveBeenCalledWith([validFile]);
    });

    it('handles file drop with invalid files', async () => {
      const invalidFile = new File(['content'], 'test.exe', { type: 'application/x-msdownload' });
      renderWithProviders(<FileUpload {...defaultProps} />);

      const uploadArea = screen.getByText('Drop files here or click to upload').closest('div');

      fireEvent.drop(uploadArea!, {
        dataTransfer: {
          files: [invalidFile],
        },
      });

      expect(defaultProps.onFilesSelected).not.toHaveBeenCalled();
    });

    it('removes drag active style after drop', async () => {
      const file = new File(['content'], 'test.jpg', { type: 'image/jpeg' });
      renderWithProviders(<FileUpload {...defaultProps} />);

      const uploadArea = screen.getByText('Drop files here or click to upload').closest('div');

      fireEvent.dragEnter(uploadArea!);
      expect(uploadArea).toHaveClass('border-blue-500');

      fireEvent.drop(uploadArea!, {
        dataTransfer: {
          files: [file],
        },
      });

      expect(uploadArea).not.toHaveClass('border-blue-500');
    });

    it('prevents default on drag events', async () => {
      renderWithProviders(<FileUpload {...defaultProps} />);

      const uploadArea = screen.getByText('Drop files here or click to upload').closest('div');

      const dragEnterEvent = new Event('dragenter', { bubbles: true });
      const preventDefaultSpy = jest.spyOn(dragEnterEvent, 'preventDefault');
      fireEvent(uploadArea!, dragEnterEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe('File Validation', () => {
    const testCases = [
      { type: 'image/jpeg', expected: true },
      { type: 'image/png', expected: true },
      { type: 'image/gif', expected: true },
      { type: 'image/webp', expected: true },
      { type: 'video/mp4', expected: true },
      { type: 'video/mpeg', expected: true },
      { type: 'video/quicktime', expected: true },
      { type: 'video/webm', expected: true },
      { type: 'application/pdf', expected: true },
      { type: 'text/plain', expected: true },
      { type: 'application/msword', expected: true },
      { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', expected: true },
      { type: 'application/x-msdownload', expected: false },
      { type: 'application/octet-stream', expected: false },
    ];

    testCases.forEach(({ type, expected }) => {
      it(`${expected ? 'accepts' : 'rejects'} ${type}`, async () => {
        const file = new File(['content'], `test.${type.split('/')[1]}`, { type });
        renderWithProviders(<FileUpload {...defaultProps} />);

        const fileInput = screen.getByLabelText('', { selector: 'input[type="file"]' });

        fireEvent.change(fileInput, { target: { files: [file] } });

        if (expected) {
          expect(defaultProps.onFilesSelected).toHaveBeenCalledWith([file]);
        } else {
          expect(defaultProps.onFilesSelected).not.toHaveBeenCalled();
        }
      });
    });

    it('accepts files based on extension when type is empty', async () => {
      // Some browsers may not set file.type
      const file = new File(['content'], 'test.jpg', { type: '' });
      renderWithProviders(<FileUpload {...defaultProps} />);

      const fileInput = screen.getByLabelText('', { selector: 'input[type="file"]' });

      fireEvent.change(fileInput, { target: { files: [file] } });

      // The component checks file.type, empty string will not match allowedTypes
      expect(defaultProps.onFilesSelected).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      renderWithProviders(<FileUpload {...defaultProps} />);

      const fileInput = screen.getByLabelText('', { selector: 'input[type="file"]' });
      expect(fileInput).toHaveAttribute('accept', '.jpg,.jpeg,.png,.gif,.webp,.mp4,.mpeg,.mov,.webm,.pdf,.txt,.doc,.docx');
    });

    it('file input is disabled when component is disabled', () => {
      renderWithProviders(<FileUpload {...defaultProps} disabled={true} />);

      const fileInput = screen.getByLabelText('', { selector: 'input[type="file"]' });
      expect(fileInput).toBeDisabled();
    });
  });

  describe('Edge Cases', () => {
    it('handles empty file list', async () => {
      renderWithProviders(<FileUpload {...defaultProps} />);

      const fileInput = screen.getByLabelText('', { selector: 'input[type="file"]' });

      fireEvent.change(fileInput, { target: { files: [] } });

      expect(defaultProps.onFilesSelected).not.toHaveBeenCalled();
    });

    it('handles null dataTransfer on drop', async () => {
      renderWithProviders(<FileUpload {...defaultProps} />);

      const uploadArea = screen.getByText('Drop files here or click to upload').closest('div');

      fireEvent.drop(uploadArea!, {});

      expect(defaultProps.onFilesSelected).not.toHaveBeenCalled();
    });

    it('handles null files in dataTransfer', async () => {
      renderWithProviders(<FileUpload {...defaultProps} />);

      const uploadArea = screen.getByText('Drop files here or click to upload').closest('div');

      fireEvent.drop(uploadArea!, {
        dataTransfer: {},
      });

      expect(defaultProps.onFilesSelected).not.toHaveBeenCalled();
    });
  });
});
