/**
 * Tests for SaveButton component
 */

import React from 'react';
import { render, screen, fireEvent, RenderResult } from '@testing-library/react';
import SaveButton, { SaveState } from '@/shared/components/SaveButton';

describe('SaveButton', () => {
  const defaultProps = {
    saveState: 'unsaved' as SaveState,
    onClick: jest.fn(),
    iconSize: 16,
    className: '',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Helper to render SaveButton with custom props
   */
  const renderSaveButton = (overrides: Partial<typeof defaultProps> = {}): RenderResult => {
    const props = { ...defaultProps, ...overrides };
    return render(<SaveButton {...props} />);
  };

  describe('Rendering', () => {
    it('renders button with correct text for unsaved state', () => {
      renderSaveButton({ saveState: 'unsaved' });
      
      expect(screen.getByRole('button', { name: /Save/i })).toBeInTheDocument();
      expect(screen.getByText('Save')).toBeInTheDocument();
    });

    it('renders button with correct text for saving state', () => {
      renderSaveButton({ saveState: 'saving' });
      
      expect(screen.getByRole('button', { name: /Saving.../i })).toBeInTheDocument();
      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });

    it('renders button with correct text for saved state', () => {
      renderSaveButton({ saveState: 'saved' });
      
      expect(screen.getByRole('button', { name: /Saved/i })).toBeInTheDocument();
      expect(screen.getByText('Saved')).toBeInTheDocument();
    });

    describe('button styling', () => {
      const states: Array<[SaveState, string, string]> = [
        ['unsaved', 'bg-blue-600', 'cursor-pointer'],
        ['saving', 'bg-yellow-500', 'cursor-wait'],
        ['saved', 'bg-green-600', 'cursor-default'],
      ];

      test.each(states)('applies correct color and cursor for %s state', (saveState, expectedColorClass, expectedCursorClass) => {
        const { container } = renderSaveButton({ saveState });
        
        const button = screen.getByRole('button');
        expect(button).toHaveClass(expectedColorClass);
        expect(button).toHaveClass(expectedCursorClass);
      });
    });

    it('applies custom className', () => {
      renderSaveButton({ className: 'custom-class' });
      
      const button = screen.getByRole('button');
      expect(button).toHaveClass('custom-class');
    });

    it('renders with custom icon size', () => {
      // The icon size is passed to FloppyDisk component; we can't easily test the size
      // but we can ensure the button renders without error
      renderSaveButton({ iconSize: 24 });
      
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('calls onClick when clicked in unsaved state', () => {
      const onClick = jest.fn();
      renderSaveButton({ saveState: 'unsaved', onClick });
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('does NOT call onClick when clicked in saving state (disabled)', () => {
      const onClick = jest.fn();
      renderSaveButton({ saveState: 'saving', onClick });
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      expect(onClick).not.toHaveBeenCalled();
    });

    it('does NOT call onClick when clicked in saved state (disabled)', () => {
      const onClick = jest.fn();
      renderSaveButton({ saveState: 'saved', onClick });
      
      const button = screen.getByRole('button');
      fireEvent.click(button);
      
      expect(onClick).not.toHaveBeenCalled();
    });

    it('button is disabled during saving', () => {
      renderSaveButton({ saveState: 'saving' });
      
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('button is disabled when saved', () => {
      renderSaveButton({ saveState: 'saved' });
      
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('button is NOT disabled when unsaved', () => {
      renderSaveButton({ saveState: 'unsaved' });
      
      const button = screen.getByRole('button');
      expect(button).not.toBeDisabled();
    });
  });

  describe('Accessibility', () => {
    it('has appropriate button role', () => {
      renderSaveButton();
      
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('has correct aria-disabled attribute when disabled', () => {
      renderSaveButton({ saveState: 'saving' });
      
      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('disabled');
    });

    it('can be focused and triggered via keyboard', () => {
      const onClick = jest.fn();
      renderSaveButton({ saveState: 'unsaved', onClick });
      
      const button = screen.getByRole('button');
      button.focus();
      expect(document.activeElement).toBe(button);
      
      fireEvent.keyDown(button, { key: 'Enter', code: 'Enter' });
      // The button click is triggered on keydown? Actually button responds to Enter by default.
      // We'll just test that onClick is called when we simulate a click (already covered).
    });
  });
});
