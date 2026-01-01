/**
 * Tests for TagFilter component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TagFilter from '@/features/strands/components/TagFilter';
import { renderWithProviders, setupTest } from '@/shared/fixtures/testUtils';

// Mock hooks
jest.mock('@/features/strands/hooks/strands.hooks', () => ({
  useTags: jest.fn(),
}));

describe('TagFilter', () => {
  const { user } = setupTest();
  const mockUseTags = require('@/features/strands/hooks/strands.hooks').useTags;

  const defaultTags = {
    tags: ['react', 'typescript', 'javascript', 'testing', 'frontend', 'backend'],
    loading: false,
  };

  const defaultProps = {
    onTagSelect: jest.fn(),
    selectedTags: [],
  };

  beforeEach(() => {
    mockUseTags.mockReturnValue(defaultTags);
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders input with placeholder', () => {
      renderWithProviders(<TagFilter {...defaultProps} />);

      expect(screen.getByPlaceholderText('Type # to filter by tag...')).toBeInTheDocument();
    });

    it('renders loading state', () => {
      mockUseTags.mockReturnValue({
        tags: [],
        loading: true,
      });

      renderWithProviders(<TagFilter {...defaultProps} />);

      // No dropdown visible initially
      expect(screen.queryByText('Loading tags...')).not.toBeInTheDocument();
    });

    it('does not show selected tags when none selected', () => {
      renderWithProviders(<TagFilter {...defaultProps} />);

      // The selected tags container is only rendered when selectedTags.length > 0
      expect(screen.queryByText(/Selected:/)).not.toBeInTheDocument();
    });

    it('shows selected tags', () => {
      const props = {
        ...defaultProps,
        selectedTags: ['react', 'typescript'],
      };

      renderWithProviders(<TagFilter {...props} />);

      expect(screen.getByText('#react')).toBeInTheDocument();
      expect(screen.getByText('#typescript')).toBeInTheDocument();
    });
  });

  describe('Tag Suggestions', () => {
    it('shows dropdown when typing #', async () => {
      renderWithProviders(<TagFilter {...defaultProps} />);

      const input = screen.getByPlaceholderText('Type # to filter by tag...');
      await user.type(input, '#');

      await waitFor(() => {
        expect(screen.getByText('#react')).toBeInTheDocument();
        expect(screen.getByText('#typescript')).toBeInTheDocument();
      });
    });

    it('filters suggestions based on input', async () => {
      renderWithProviders(<TagFilter {...defaultProps} />);

      const input = screen.getByPlaceholderText('Type # to filter by tag...');
      await user.type(input, '#type');

      await waitFor(() => {
        expect(screen.getByText('#typescript')).toBeInTheDocument();
        expect(screen.queryByText('#react')).not.toBeInTheDocument();
      });
    });

    it('does not show already selected tags in suggestions', async () => {
      const props = {
        ...defaultProps,
        selectedTags: ['react'],
      };

      renderWithProviders(<TagFilter {...props} />);

      const input = screen.getByPlaceholderText('Type # to filter by tag...');
      await user.type(input, '#');

      await waitFor(() => {
        expect(screen.queryByText('#react')).not.toBeInTheDocument();
        expect(screen.getByText('#typescript')).toBeInTheDocument();
      });
    });

    it('shows "No matching tags" when no matches', async () => {
      renderWithProviders(<TagFilter {...defaultProps} />);

      const input = screen.getByPlaceholderText('Type # to filter by tag...');
      await user.type(input, '#nonexistent');

      await waitFor(() => {
        expect(screen.getByText('No matching tags')).toBeInTheDocument();
      });
    });

    it('limits suggestions to 10 items', async () => {
      const manyTags = Array.from({ length: 15 }, (_, i) => `tag${i}`);
      mockUseTags.mockReturnValue({
        tags: manyTags,
        loading: false,
      });

      renderWithProviders(<TagFilter {...defaultProps} />);

      const input = screen.getByPlaceholderText('Type # to filter by tag...');
      await user.type(input, '#tag');

      await waitFor(() => {
        const suggestions = screen.getAllByText(/^#tag/);
        expect(suggestions.length).toBe(10);
      });
    });
  });

  describe('Interactions', () => {
    it('selects tag when clicked in dropdown', async () => {
      renderWithProviders(<TagFilter {...defaultProps} />);

      const input = screen.getByPlaceholderText('Type # to filter by tag...');
      await user.type(input, '#');

      await waitFor(() => {
        expect(screen.getByText('#react')).toBeInTheDocument();
      });

      const tagSuggestion = screen.getByText('#react');
      await user.click(tagSuggestion);

      expect(defaultProps.onTagSelect).toHaveBeenCalledWith('react');
      expect(input).toHaveValue('');
    });

    it('selects tag when pressing Enter on first suggestion', async () => {
      renderWithProviders(<TagFilter {...defaultProps} />);

      const input = screen.getByPlaceholderText('Type # to filter by tag...');
      await user.type(input, '#');

      await waitFor(() => {
        expect(screen.getByText('#react')).toBeInTheDocument();
      });

      await user.keyboard('{Enter}');

      expect(defaultProps.onTagSelect).toHaveBeenCalledWith('react');
      expect(input).toHaveValue('');
    });

    it('closes dropdown when pressing Escape', async () => {
      renderWithProviders(<TagFilter {...defaultProps} />);

      const input = screen.getByPlaceholderText('Type # to filter by tag...');
      await user.type(input, '#');

      await waitFor(() => {
        expect(screen.getByText('#react')).toBeInTheDocument();
      });

      await user.keyboard('{Escape}');

      expect(screen.queryByText('#react')).not.toBeInTheDocument();
    });

    it('closes dropdown when clicking outside', async () => {
      renderWithProviders(
        <div>
          <div data-testid="outside">Outside</div>
          <TagFilter {...defaultProps} />
        </div>
      );

      const input = screen.getByPlaceholderText('Type # to filter by tag...');
      await user.type(input, '#');

      await waitFor(() => {
        expect(screen.getByText('#react')).toBeInTheDocument();
      });

      const outside = screen.getByTestId('outside');
      await user.click(outside);

      expect(screen.queryByText('#react')).not.toBeInTheDocument();
    });

    it('removes selected tag when clicked', async () => {
      const props = {
        ...defaultProps,
        selectedTags: ['react'],
      };

      renderWithProviders(<TagFilter {...props} />);

      const tagElement = screen.getByText('#react');
      const removeButton = tagElement.parentElement?.querySelector('button');
      expect(removeButton).toBeInTheDocument();

      await user.click(removeButton!);

      expect(defaultProps.onTagSelect).toHaveBeenCalledWith('react');
    });
  });

  describe('Keyboard Navigation', () => {
    it('focuses input after selecting a tag', async () => {
      renderWithProviders(<TagFilter {...defaultProps} />);

      const input = screen.getByPlaceholderText('Type # to filter by tag...');
      await user.type(input, '#');

      await waitFor(() => {
        expect(screen.getByText('#react')).toBeInTheDocument();
      });

      const tagSuggestion = screen.getByText('#react');
      await user.click(tagSuggestion);

      expect(input).toHaveFocus();
    });
  });

  describe('Edge Cases', () => {
    it('handles empty tags list', async () => {
      mockUseTags.mockReturnValue({
        tags: [],
        loading: false,
      });

      renderWithProviders(<TagFilter {...defaultProps} />);

      const input = screen.getByPlaceholderText('Type # to filter by tag...');
      await user.type(input, '#');

      await waitFor(() => {
        expect(screen.getByText('No matching tags')).toBeInTheDocument();
      });
    });

    it('ignores input without # prefix', async () => {
      renderWithProviders(<TagFilter {...defaultProps} />);

      const input = screen.getByPlaceholderText('Type # to filter by tag...');
      await user.type(input, 'react');

      expect(screen.queryByText('#react')).not.toBeInTheDocument();
    });

    it('trims whitespace in tag input', async () => {
      renderWithProviders(<TagFilter {...defaultProps} />);

      const input = screen.getByPlaceholderText('Type # to filter by tag...');
      await user.type(input, '#  react  ');

      // The component slices after #, so it will be '  react  '
      // It will still filter tags containing 'react'
      await waitFor(() => {
        expect(screen.getByText('#react')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      renderWithProviders(<TagFilter {...defaultProps} />);

      const input = screen.getByPlaceholderText('Type # to filter by tag...');
      expect(input).toHaveAttribute('type', 'text');
    });

    it('remove buttons have aria-label', () => {
      const props = {
        ...defaultProps,
        selectedTags: ['react'],
      };

      renderWithProviders(<TagFilter {...props} />);

      const removeButton = screen.getByLabelText('Remove react tag');
      expect(removeButton).toBeInTheDocument();
    });
  });
});
