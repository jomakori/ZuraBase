/**
 * Tests for Dialog component
 */

import React from 'react';
import { render, screen, fireEvent, RenderResult } from '@testing-library/react';
import Dialog, { DialogVariant } from '@/shared/components/Dialog';

describe('Dialog', () => {
  const defaultProps = {
    isOpen: true,
    title: 'Test Dialog',
    message: 'This is a test message.',
    variant: 'info' as DialogVariant,
    confirmText: 'OK',
    cancelText: 'Cancel',
    onConfirm: jest.fn(),
    onCancel: jest.fn(),
    showCancel: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Helper to render Dialog with custom props
   */
  const renderDialog = (overrides: Partial<typeof defaultProps> = {}): RenderResult => {
    const props = { ...defaultProps, ...overrides };
    return render(<Dialog {...props} />);
  };

  describe('Rendering', () => {
    it('renders nothing when isOpen is false', () => {
      const { container } = renderDialog({ isOpen: false });
      
      // The component returns null when not open
      expect(container.firstChild).toBeNull();
    });

    it('renders dialog with title and message when open', () => {
      renderDialog();
      
      expect(screen.getByText('Test Dialog')).toBeInTheDocument();
      expect(screen.getByText('This is a test message.')).toBeInTheDocument();
    });

    describe('variant icon colors', () => {
      const variants: Array<[DialogVariant, string]> = [
        ['info', 'text-blue-600'],
        ['success', 'text-green-600'],
        ['warning', 'text-yellow-600'],
        ['danger', 'text-red-600'],
      ];

      test.each(variants)('renders correct icon color for %s variant', (variant, expectedClass) => {
        renderDialog({ variant });
        
        const iconContainer = screen.getByRole('dialog').querySelector('svg');
        expect(iconContainer).toBeInTheDocument();
        expect(iconContainer).toHaveClass(expectedClass);
      });
    });

    describe('variant background colors', () => {
      const variants: Array<[DialogVariant, string]> = [
        ['info', 'bg-blue-50'],
        ['success', 'bg-green-50'],
        ['warning', 'bg-yellow-50'],
        ['danger', 'bg-red-50'],
      ];

      test.each(variants)('applies correct background color for %s variant', (variant, expectedClass) => {
        renderDialog({ variant });
        
        const header = screen.getByText('Test Dialog').closest('div');
        expect(header).toHaveClass(expectedClass);
      });
    });

    it('renders confirm button with default text', () => {
      renderDialog();
      
      const confirmButton = screen.getByRole('button', { name: /OK/i });
      expect(confirmButton).toBeInTheDocument();
    });

    it('renders cancel button when showCancel is true and onCancel provided', () => {
      renderDialog();
      
      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      expect(cancelButton).toBeInTheDocument();
    });

    it('does not render cancel button when showCancel is false', () => {
      renderDialog({ showCancel: false });
      
      const cancelButton = screen.queryByRole('button', { name: /Cancel/i });
      expect(cancelButton).not.toBeInTheDocument();
    });

    it('does not render cancel button when onCancel is not provided', () => {
      renderDialog({ onCancel: undefined });
      
      const cancelButton = screen.queryByRole('button', { name: /Cancel/i });
      expect(cancelButton).not.toBeInTheDocument();
    });

    it('does not render confirm button when onConfirm is not provided', () => {
      renderDialog({ onConfirm: undefined });
      
      const confirmButton = screen.queryByRole('button', { name: /OK/i });
      expect(confirmButton).not.toBeInTheDocument();
    });

    it('uses custom button texts', () => {
      renderDialog({ confirmText: "Confirm", cancelText: "Abort" });
      
      expect(screen.getByRole('button', { name: /Confirm/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Abort/i })).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('calls onConfirm when confirm button is clicked', () => {
      const onConfirm = jest.fn();
      renderDialog({ onConfirm });
      
      const confirmButton = screen.getByRole('button', { name: /OK/i });
      fireEvent.click(confirmButton);
      
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('calls onCancel when cancel button is clicked', () => {
      const onCancel = jest.fn();
      renderDialog({ onCancel });
      
      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      fireEvent.click(cancelButton);
      
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('calls onCancel when close (X) button is clicked', () => {
      const onCancel = jest.fn();
      renderDialog({ onCancel });
      
      // The X button is inside the header
      const closeButton = screen.getByRole('button', { name: '' }); // X button has no text
      fireEvent.click(closeButton);
      
      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('does not call onCancel when close button is clicked but onCancel not provided', () => {
      const onCancel = jest.fn();
      renderDialog({ onCancel: undefined });
      
      // The X button should not be rendered when onCancel is undefined
      const closeButton = screen.queryByRole('button', { name: '' });
      expect(closeButton).not.toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has appropriate ARIA attributes', () => {
      renderDialog();
      
      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });

    it('focuses on confirm button by default? (not implemented)', () => {
      // The component doesn't implement auto-focus, but we can still test it renders
      renderDialog();
      
      const confirmButton = screen.getByRole('button', { name: /OK/i });
      expect(confirmButton).toBeInTheDocument();
    });
  });
});
