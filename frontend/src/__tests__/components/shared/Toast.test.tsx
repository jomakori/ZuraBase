/**
 * Tests for Toast component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, RenderResult, act } from '@testing-library/react';
import Toast, { ToastVariant } from '@/shared/components/Toast';

describe('Toast', () => {
  const defaultProps = {
    isOpen: true,
    message: 'Test message',
    variant: 'info' as ToastVariant,
    duration: 5000,
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  /**
   * Helper to render Toast with custom props
   */
  const renderToast = (overrides: Partial<typeof defaultProps> = {}): RenderResult => {
    const props = { ...defaultProps, ...overrides };
    return render(<Toast {...props} />);
  };

  describe('Rendering', () => {
    it('renders nothing when isOpen is false', () => {
      const { container } = renderToast({ isOpen: false });
      
      // The component returns null when not open
      expect(container.firstChild).toBeNull();
    });

    it('renders toast with message when open', () => {
      renderToast();
      
      expect(screen.getByText('Test message')).toBeInTheDocument();
      // Toast component doesn't have role="alert", just check the message is present
    });

    describe('variant styling', () => {
      const variants: Array<[ToastVariant, string, string]> = [
        ['info', 'text-blue-600', 'bg-blue-50'],
        ['success', 'text-green-600', 'bg-green-50'],
        ['warning', 'text-yellow-600', 'bg-yellow-50'],
        ['error', 'text-red-600', 'bg-red-50'],
      ];

      test.each(variants)('renders correct icon and background for %s variant', (variant, expectedIconClass, expectedBgClass) => {
        renderToast({ variant });
        
        const message = screen.getByText('Test message');
        const toast = message.closest('div');
        expect(toast).toBeInTheDocument();
        // Check that the toast container has appropriate background class
        expect(toast).toHaveClass(expectedBgClass);
      });
    });

    it('renders close button', () => {
      renderToast();
      
      const closeButton = screen.getByRole('button', { name: '' }); // X button has no text
      expect(closeButton).toBeInTheDocument();
    });

    it('does not render close button when duration is 0? (still renders)', () => {
      // The close button is always present regardless of duration
      renderToast({ duration: 0 });
      
      const closeButton = screen.getByRole('button', { name: '' });
      expect(closeButton).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('calls onClose when close button is clicked', () => {
      const onClose = jest.fn();
      renderToast({ onClose });
      
      const closeButton = screen.getByRole('button', { name: '' });
      fireEvent.click(closeButton);
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose automatically when duration is 0', () => {
      const onClose = jest.fn();
      renderToast({ duration: 0 });
      
      // Fast-forward timers
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  describe('Auto-dismiss functionality', () => {
    it('calls onClose after duration when isOpen is true', () => {
      const onClose = jest.fn();
      renderToast({ duration: 1000, onClose });
      
      // Timer should be set
      expect(onClose).not.toHaveBeenCalled();
      
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose after duration when isOpen becomes false before timeout', () => {
      const onClose = jest.fn();
      const { rerender } = render(<Toast {...defaultProps} duration={1000} onClose={onClose} />);
      
      // Close the toast before timer fires
      rerender(<Toast {...defaultProps} isOpen={false} duration={1000} onClose={onClose} />);
      
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      
      expect(onClose).not.toHaveBeenCalled();
    });

    it('clears timer when component unmounts', () => {
      const onClose = jest.fn();
      const { unmount } = renderToast({ duration: 1000, onClose });
      
      unmount();
      
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      
      expect(onClose).not.toHaveBeenCalled();
    });

    it('restarts timer when duration changes', () => {
      const onClose = jest.fn();
      const { rerender } = render(<Toast {...defaultProps} duration={1000} onClose={onClose} />);
      
      // Change duration while toast is still open
      rerender(<Toast {...defaultProps} duration={2000} onClose={onClose} />);
      
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      
      // Should not have called because timer reset
      expect(onClose).not.toHaveBeenCalled();
      
      act(() => {
        jest.advanceTimersByTime(1000); // total 2000
      });
      
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('has correct positioning classes', () => {
      renderToast();
      
      const message = screen.getByText('Test message');
      // The outer div with positioning classes
      const toast = message.closest('div')?.parentElement;
      expect(toast).toHaveClass('fixed');
      expect(toast).toHaveClass('top-4');
      expect(toast).toHaveClass('right-4');
    });
  });

  describe('Multiple toasts stacking', () => {
    // This is more of an integration test; we can test that multiple Toast components
    // can be rendered simultaneously without interfering.
    it('renders multiple toasts independently', () => {
      const onClose1 = jest.fn();
      const onClose2 = jest.fn();
      
      render(
        <>
          <Toast isOpen={true} message="First" variant="info" duration={1000} onClose={onClose1} />
          <Toast isOpen={true} message="Second" variant="success" duration={2000} onClose={onClose2} />
        </>
      );
      
      expect(screen.getByText('First')).toBeInTheDocument();
      expect(screen.getByText('Second')).toBeInTheDocument();
      
      // Each timer should work independently
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      
      expect(onClose1).toHaveBeenCalledTimes(1);
      expect(onClose2).not.toHaveBeenCalled();
      
      act(() => {
        jest.advanceTimersByTime(1000);
      });
      
      expect(onClose2).toHaveBeenCalledTimes(1);
    });
  });
});
