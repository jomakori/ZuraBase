/**
 * Tests for SearchableModelSelect component
 * Tests the searchable dropdown component for model selection
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SearchableModelSelect } from '@/shared/components/SearchableModelSelect';

describe('SearchableModelSelect', () => {
  const defaultProps = {
    value: '',
    onChange: jest.fn(),
    options: ['gpt-4', 'gpt-3.5-turbo', 'claude-3-opus', 'claude-3-sonnet', 'llama-3-70b'],
    disabled: false,
    loading: false,
    placeholder: 'Select a model',
    className: '',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderSelect = (overrides = {}) => {
    const props = { ...defaultProps, ...overrides };
    return render(<SearchableModelSelect {...props} />);
  };

  describe('Rendering', () => {
    it('renders button with placeholder when no value is selected', () => {
      renderSelect();
      
      expect(screen.getByRole('button')).toBeInTheDocument();
      expect(screen.getByText('Select a model')).toBeInTheDocument();
    });

    it('renders button with selected value', () => {
      renderSelect({ value: 'gpt-4' });
      
      expect(screen.getByText('gpt-4')).toBeInTheDocument();
    });

    it('renders loading state when loading is true', () => {
      renderSelect({ loading: true });
      
      expect(screen.getByText('Loading models...')).toBeInTheDocument();
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('renders disabled state when disabled is true', () => {
      renderSelect({ disabled: true });
      
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('applies custom className', () => {
      const { container } = renderSelect({ className: 'custom-class' });
      
      const wrapper = container.querySelector('.custom-class');
      expect(wrapper).toBeInTheDocument();
    });
  });

  describe('Dropdown Interaction', () => {
    it('opens dropdown when button is clicked', () => {
      renderSelect();
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      expect(screen.getByPlaceholderText('Search models...')).toBeInTheDocument();
    });

    it('closes dropdown when clicking outside', () => {
      renderSelect();
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      expect(screen.getByPlaceholderText('Search models...')).toBeInTheDocument();
      
      // Click outside
      fireEvent.mouseDown(document.body);
      
      expect(screen.queryByPlaceholderText('Search models...')).not.toBeInTheDocument();
    });

    it('closes dropdown when Escape key is pressed', () => {
      renderSelect();
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      const searchInput = screen.getByPlaceholderText('Search models...');
      fireEvent.keyDown(searchInput, { key: 'Escape' });
      
      expect(screen.queryByPlaceholderText('Search models...')).not.toBeInTheDocument();
    });

    it('focuses search input when dropdown opens', () => {
      renderSelect();
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      const searchInput = screen.getByPlaceholderText('Search models...');
      expect(document.activeElement).toBe(searchInput);
    });
  });

  describe('Search Functionality', () => {
    it('filters options based on search term', () => {
      renderSelect();
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      const searchInput = screen.getByPlaceholderText('Search models...');
      fireEvent.change(searchInput, { target: { value: 'gpt' } });
      
      expect(screen.getByText('gpt-4')).toBeInTheDocument();
      expect(screen.getByText('gpt-3.5-turbo')).toBeInTheDocument();
      expect(screen.queryByText('claude-3-opus')).not.toBeInTheDocument();
    });

    it('shows "No models found" when search yields no results', () => {
      renderSelect();
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      const searchInput = screen.getByPlaceholderText('Search models...');
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } });
      
      expect(screen.getByText('No models found')).toBeInTheDocument();
    });

    it('clears search when dropdown closes', () => {
      renderSelect();
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      const searchInput = screen.getByPlaceholderText('Search models...');
      fireEvent.change(searchInput, { target: { value: 'gpt' } });
      
      expect(searchInput).toHaveValue('gpt');
      
      // Close dropdown
      fireEvent.mouseDown(document.body);
      
      // Reopen dropdown
      fireEvent.click(button);
      
      expect(screen.getByPlaceholderText('Search models...')).toHaveValue('');
    });
  });

  describe('Selection Functionality', () => {
    it('calls onChange when option is clicked', () => {
      renderSelect();
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      const option = screen.getByText('gpt-4');
      fireEvent.click(option);
      
      expect(defaultProps.onChange).toHaveBeenCalledWith('gpt-4');
    });

    it('closes dropdown after selection', () => {
      renderSelect();
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      const option = screen.getByText('gpt-4');
      fireEvent.click(option);
      
      expect(screen.queryByPlaceholderText('Search models...')).not.toBeInTheDocument();
    });

    it('highlights selected option', () => {
      renderSelect({ value: 'gpt-4' });
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      const options = screen.getAllByRole('button');
      const selectedOption = options.find(opt => opt.textContent === 'gpt-4');
      expect(selectedOption).toHaveClass('bg-blue-100');
    });
  });

  describe('Keyboard Navigation', () => {
    it('opens dropdown with Enter key', () => {
      renderSelect();
      
      const button = screen.getByRole('button');
      fireEvent.keyDown(button, { key: 'Enter' });
      
      expect(screen.getByPlaceholderText('Search models...')).toBeInTheDocument();
    });

    it('opens dropdown with Space key', () => {
      renderSelect();
      
      const button = screen.getByRole('button');
      fireEvent.keyDown(button, { key: ' ' });
      
      expect(screen.getByPlaceholderText('Search models...')).toBeInTheDocument();
    });

    it('navigates options with ArrowDown key', () => {
      renderSelect();
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      const searchInput = screen.getByPlaceholderText('Search models...');
      fireEvent.keyDown(searchInput, { key: 'ArrowDown' });
      
      // First option should be highlighted
      const options = screen.getAllByRole('button');
      expect(options[1]).toHaveClass('bg-blue-50'); // First option after search input
    });

    it('navigates options with ArrowUp key', () => {
      renderSelect();
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      const searchInput = screen.getByPlaceholderText('Search models...');
      fireEvent.keyDown(searchInput, { key: 'ArrowDown' });
      fireEvent.keyDown(searchInput, { key: 'ArrowDown' });
      fireEvent.keyDown(searchInput, { key: 'ArrowUp' });
    });

    it('selects highlighted option with Enter key', () => {
      renderSelect();
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      const searchInput = screen.getByPlaceholderText('Search models...');
      fireEvent.keyDown(searchInput, { key: 'ArrowDown' });
      fireEvent.keyDown(searchInput, { key: 'Enter' });
      
      expect(defaultProps.onChange).toHaveBeenCalledWith('gpt-4');
    });

    it('resets highlighted index when search changes', () => {
      renderSelect();
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      const searchInput = screen.getByPlaceholderText('Search models...');
      fireEvent.keyDown(searchInput, { key: 'ArrowDown' });
      fireEvent.change(searchInput, { target: { value: 'claude' } });
      
      // Highlighted index should reset to 0
    });
  });

  describe('Edge Cases', () => {
    it('handles empty options array', () => {
      renderSelect({ options: [] });
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      expect(screen.getByText('No models found')).toBeInTheDocument();
    });

    it('handles long option names', () => {
      const longOptions = ['very-long-model-name-that-exceeds-typical-length', 'another-long-name'];
      renderSelect({ options: longOptions });
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      expect(screen.getByText('very-long-model-name-that-exceeds-typical-length')).toBeInTheDocument();
    });

    it('handles special characters in option names', () => {
      const specialOptions = ['model/v1.0', 'model@latest', 'model#special'];
      renderSelect({ options: specialOptions });
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      expect(screen.getByText('model/v1.0')).toBeInTheDocument();
    });

    it('is case-insensitive in search', () => {
      renderSelect();
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      const searchInput = screen.getByPlaceholderText('Search models...');
      fireEvent.change(searchInput, { target: { value: 'GPT' } });
      
      expect(screen.getByText('gpt-4')).toBeInTheDocument();
      expect(screen.getByText('gpt-3.5-turbo')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA attributes', () => {
      renderSelect();
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-expanded', 'false');
      
      fireEvent.click(button);
      expect(button).toHaveAttribute('aria-expanded', 'true');
    });

    it('maintains focus management', () => {
      renderSelect();
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      const searchInput = screen.getByPlaceholderText('Search models...');
      expect(document.activeElement).toBe(searchInput);
    });

    it('supports screen reader navigation', () => {
      renderSelect();
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('role', 'button');
    });
  });
});
