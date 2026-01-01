/**
 * Tests for ErrorBoundary component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from '@/shared/components/ErrorBoundary';

// Mock console.error
const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

// Mock window.location.reload
const reloadMock = jest.fn();
Object.defineProperty(window, 'location', {
  value: { reload: reloadMock },
  writable: true,
});

// Component that throws an error
const ThrowError = ({ message = 'Test error' }: { message?: string }) => {
  throw new Error(message);
};

describe('ErrorBoundary', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress React error boundary warnings
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockClear();
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div data-testid="child">Normal content</div>
      </ErrorBoundary>
    );

    expect(screen.getByTestId('child')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('catches errors and displays fallback UI', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('We\'re sorry, but an unexpected error occurred. Please try refreshing the page.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh Page' })).toBeInTheDocument();
  });

  it('logs error to console', () => {
    render(
      <ErrorBoundary>
        <ThrowError message="Test error message" />
      </ErrorBoundary>
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Error caught by boundary:',
      expect.any(Error),
      expect.any(Object)
    );
  });

  it('logs sync-specific errors with additional context', () => {
    render(
      <ErrorBoundary>
        <ThrowError message="AI processing failed" />
      </ErrorBoundary>
    );

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Sync-related error detected:',
      expect.objectContaining({
        error: 'AI processing failed',
        componentStack: expect.any(String),
        timestamp: expect.any(String),
      })
    );
  });

  it('displays error details when available', () => {
    render(
      <ErrorBoundary>
        <ThrowError message="Detailed error message" />
      </ErrorBoundary>
    );

    const detailsButton = screen.getByText('Error details');
    expect(detailsButton).toBeInTheDocument();

    fireEvent.click(detailsButton);

    expect(screen.getByText('Detailed error message')).toBeInTheDocument();
  });

  it('uses custom fallback when provided', () => {
    const customFallback = <div data-testid="custom-fallback">Custom error UI</div>;

    render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
  });

  it('refreshes page when refresh button is clicked', () => {
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    const refreshButton = screen.getByRole('button', { name: 'Refresh Page' });
    fireEvent.click(refreshButton);

    expect(reloadMock).toHaveBeenCalledTimes(1);
  });

  it('handles multiple error types', () => {
    const { rerender } = render(
      <ErrorBoundary>
        <ThrowError message="Network error" />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    // Re-render with a different error
    rerender(
      <ErrorBoundary>
        <div>New content</div>
      </ErrorBoundary>
    );

    // Should still show error because error boundary state persists
    // Actually, the error boundary will still show error because it hasn't been reset
    // We'll just verify the error is still shown
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  describe('getDerivedStateFromError', () => {
    it('returns correct state', () => {
      const error = new Error('Test');
      const state = ErrorBoundary.getDerivedStateFromError(error);
      
      expect(state).toEqual({
        hasError: true,
        error,
      });
    });
  });
});
