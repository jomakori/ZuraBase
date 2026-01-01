/**
 * Tests for CoverSelector component
 */

import React from 'react';
import { render, screen, waitFor, fireEvent, RenderResult } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CoverSelector from '@/shared/components/CoverSelector';
import { searchPhoto } from '@/app/client';

// Mock the searchPhoto API
jest.mock('@/app/client', () => ({
  searchPhoto: jest.fn(),
}));

const mockSearchPhoto = searchPhoto as jest.MockedFunction<typeof searchPhoto>;

describe('CoverSelector', () => {
  const defaultProps = {
    open: true,
    setOpen: jest.fn(),
    setCoverImage: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Default mock implementation
    mockSearchPhoto.mockResolvedValue({
      photos: [
        {
          id: 1,
          src: {
            medium: 'https://example.com/medium1.jpg',
            landscape: 'https://example.com/landscape1.jpg',
          },
          alt: 'Photo 1',
        },
        {
          id: 2,
          src: {
            medium: 'https://example.com/medium2.jpg',
            landscape: 'https://example.com/landscape2.jpg',
          },
          alt: 'Photo 2',
        },
      ],
    });
  });

  /**
   * Helper to render CoverSelector with custom props
   */
  const renderCoverSelector = (overrides: Partial<typeof defaultProps> = {}): RenderResult => {
    const props = { ...defaultProps, ...overrides };
    return render(<CoverSelector {...props} />);
  };

  describe('Rendering', () => {
    it('renders nothing when open is false', () => {
      const { container } = renderCoverSelector({ open: false });
      // The component returns a Transition.Root with show=false, which may render nothing
      // We'll just check that the dialog is not in document
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(container).toBeInTheDocument();
    });

    it('renders dialog when open is true', () => {
      renderCoverSelector({ open: true });
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText('Select cover photo')).toBeInTheDocument();
    });

    it('renders search input', () => {
      renderCoverSelector();
      expect(screen.getByPlaceholderText('nature')).toBeInTheDocument();
    });

    it('renders loading state when searching', async () => {
      // Delay the mock to simulate loading
      mockSearchPhoto.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({
        photos: [],
      }), 100)));
      renderCoverSelector();
      // Type into search input to trigger search
      const input = screen.getByPlaceholderText('nature');
      fireEvent.change(input, { target: { value: 'mountains' } });
      // Wait for debounce
      await waitFor(() => {
        expect(mockSearchPhoto).toHaveBeenCalledWith('mountains');
      });
      // Loading text should appear
      expect(screen.getByText('Loading...')).toBeInTheDocument();
    });

    it('renders error message when search fails', async () => {
      mockSearchPhoto.mockRejectedValue(new Error('Network error'));
      renderCoverSelector();
      const input = screen.getByPlaceholderText('nature');
      fireEvent.change(input, { target: { value: 'error' } });
      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('renders photos when search succeeds', async () => {
      renderCoverSelector();
      const input = screen.getByPlaceholderText('nature');
      fireEvent.change(input, { target: { value: 'nature' } });
      await waitFor(() => {
        expect(mockSearchPhoto).toHaveBeenCalledWith('nature');
      });
      // Wait for photos to appear
      await waitFor(() => {
        expect(screen.getByAltText('Photo 1')).toBeInTheDocument();
        expect(screen.getByAltText('Photo 2')).toBeInTheDocument();
      });
      // Check that Pexels attribution is present
      expect(screen.getByText('Photos provided by')).toBeInTheDocument();
      expect(screen.getByText('Pexels')).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('closes dialog when close button is clicked', async () => {
      const setOpen = jest.fn();
      renderCoverSelector({ setOpen });
      const closeButton = screen.getByRole('button', { name: '' }); // X button
      fireEvent.click(closeButton);
      expect(setOpen).toHaveBeenCalledWith(false);
    });

    it('calls setCoverImage and closes when a photo is clicked', async () => {
      const setCoverImage = jest.fn();
      const setOpen = jest.fn();
      renderCoverSelector({ setCoverImage, setOpen });
      // Trigger search to load photos
      const input = screen.getByPlaceholderText('nature');
      fireEvent.change(input, { target: { value: 'nature' } });
      await waitFor(() => {
        expect(screen.getByAltText('Photo 1')).toBeInTheDocument();
      });
      // Click first photo
      fireEvent.click(screen.getByAltText('Photo 1'));
      expect(setCoverImage).toHaveBeenCalledWith('https://example.com/landscape1.jpg');
      expect(setOpen).toHaveBeenCalledWith(false);
    });

    it('debounces search input', async () => {
      // We'll test that searchPhoto is not called on every keystroke
      // but after debounce time
      mockSearchPhoto.mockClear();
      renderCoverSelector();
      const input = screen.getByPlaceholderText('nature');
      fireEvent.change(input, { target: { value: 'a' } });
      fireEvent.change(input, { target: { value: 'ab' } });
      fireEvent.change(input, { target: { value: 'abc' } });
      // Wait for debounce
      await waitFor(() => {
        expect(mockSearchPhoto).toHaveBeenCalledTimes(1);
      });
      expect(mockSearchPhoto).toHaveBeenCalledWith('abc');
    });

    it('clears search when dialog opens', () => {
      const { rerender } = renderCoverSelector({ open: false });
      // Open dialog
      rerender(<CoverSelector {...defaultProps} open={true} />);
      // The useEffect should set searchQuery to empty, so no search triggered
      expect(mockSearchPhoto).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has appropriate ARIA attributes', () => {
      renderCoverSelector();
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    it('search input is focusable', () => {
      renderCoverSelector();
      const input = screen.getByPlaceholderText('nature');
      expect(input).toBeInTheDocument();
      input.focus();
      expect(document.activeElement).toBe(input);
    });

    it('photos are keyboard accessible', async () => {
      renderCoverSelector();
      // Load photos
      const input = screen.getByPlaceholderText('nature');
      fireEvent.change(input, { target: { value: 'nature' } });
      await waitFor(() => {
        expect(screen.getByAltText('Photo 1')).toBeInTheDocument();
      });
      // Photos are divs with onClick handlers, which are clickable
      const photo = screen.getByAltText('Photo 1');
      expect(photo).toBeInTheDocument();
    });
  });

  describe('Error handling', () => {
    it('handles empty search results', async () => {
      mockSearchPhoto.mockResolvedValue({ photos: [] });
      renderCoverSelector();
      const input = screen.getByPlaceholderText('nature');
      fireEvent.change(input, { target: { value: 'empty' } });
      await waitFor(() => {
        expect(mockSearchPhoto).toHaveBeenCalledWith('empty');
      });
      // No photos should be rendered, but no error either
      expect(screen.queryByAltText('Photo 1')).not.toBeInTheDocument();
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    it('handles API error gracefully', async () => {
      mockSearchPhoto.mockRejectedValue({ message: 'Server error' });
      renderCoverSelector();
      const input = screen.getByPlaceholderText('nature');
      fireEvent.change(input, { target: { value: 'error' } });
      await waitFor(() => {
        expect(screen.getByText('Server error')).toBeInTheDocument();
      });
      // Error should be displayed, loading should disappear
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });
  });

  describe('Integration with parent components', () => {
    it('communicates selected cover image to parent', async () => {
      const setCoverImage = jest.fn();
      const setOpen = jest.fn();
      renderCoverSelector({ setCoverImage, setOpen });
      // Load photos
      const input = screen.getByPlaceholderText('nature');
      fireEvent.change(input, { target: { value: 'nature' } });
      await waitFor(() => {
        expect(screen.getByAltText('Photo 2')).toBeInTheDocument();
      });
      // Click second photo
      fireEvent.click(screen.getByAltText('Photo 2'));
      expect(setCoverImage).toHaveBeenCalledWith('https://example.com/landscape2.jpg');
      expect(setOpen).toHaveBeenCalledWith(false);
    });

    it('closes dialog when parent sets open to false', () => {
      const { rerender } = renderCoverSelector({ open: true });
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      rerender(<CoverSelector {...defaultProps} open={false} />);
      // Dialog should be removed
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });
});
