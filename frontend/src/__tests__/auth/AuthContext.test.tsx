/**
 * Tests for AuthContext provider and useAuth hook
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { AuthProvider, useAuth } from '@/features/auth/context/AuthContext';
import { setupMockHandlers, cleanupMockHandlers } from '@/shared/fixtures/mockHandlers';

// Mock fetch
global.fetch = jest.fn();

// Mock console methods
const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

// Test component that uses the auth hook
const TestComponent = () => {
  const auth = useAuth();
  return (
    <div>
      <div data-testid="user-id">{auth.user?.id || 'null'}</div>
      <div data-testid="user-email">{auth.user?.email || 'null'}</div>
      <div data-testid="loading">{auth.loading ? 'true' : 'false'}</div>
      <button data-testid="login-btn" onClick={auth.login}>Login</button>
      <button data-testid="logout-btn" onClick={auth.logout}>Logout</button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMockHandlers();
  });

  afterEach(() => {
    cleanupMockHandlers();
  });

  describe('AuthProvider', () => {
    it('renders children and provides initial loading state', () => {
      render(
        <AuthProvider>
          <div data-testid="child">Child</div>
        </AuthProvider>
      );

      expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    it('fetches user on mount and updates state', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'avatar.jpg',
      };

      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockUser),
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      // Initially loading should be true
      expect(screen.getByTestId('loading')).toHaveTextContent('true');

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      expect(screen.getByTestId('user-id')).toHaveTextContent('user-123');
      expect(screen.getByTestId('user-email')).toHaveTextContent('test@example.com');
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/user'),
        expect.objectContaining({ credentials: 'include' })
      );
    });

    it('handles fetch error gracefully', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
      });

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      expect(screen.getByTestId('user-id')).toHaveTextContent('null');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to fetch user:',
        expect.any(Error)
      );
    });

    it('handles network error during user fetch', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('loading')).toHaveTextContent('false');
      });

      expect(screen.getByTestId('user-id')).toHaveTextContent('null');
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to fetch user:',
        expect.any(Error)
      );
    });
  });

  describe('useAuth hook', () => {
    it('throws error when used outside AuthProvider', () => {
      // Suppress React error boundary warning
      const originalError = console.error;
      console.error = jest.fn();

      expect(() => {
        render(<TestComponent />);
      }).toThrow('useAuth must be used within an AuthProvider');

      console.error = originalError;
    });

    it('provides login function that redirects', () => {
      const mockLocation = { href: '' };
      Object.defineProperty(window, 'location', {
        value: { ...window.location, ...mockLocation },
        writable: true,
      });
      const locationSpy = jest.spyOn(window.location, 'href', 'set');

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      act(() => {
        screen.getByTestId('login-btn').click();
      });

      expect(locationSpy).toHaveBeenCalledWith(expect.stringContaining('/auth/google'));
    });

    it('provides logout function that clears user and redirects', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'avatar.jpg',
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockUser),
        })
        .mockResolvedValueOnce({
          ok: true,
        });

      const mockLocation = { href: '' };
      Object.defineProperty(window, 'location', {
        value: { ...window.location, ...mockLocation },
        writable: true,
      });
      const locationSpy = jest.spyOn(window.location, 'href', 'set');

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user-id')).toHaveTextContent('user-123');
      });

      act(() => {
        screen.getByTestId('logout-btn').click();
      });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/auth/logout'),
          expect.objectContaining({ method: 'POST', credentials: 'include' })
        );
      });

      // User should be cleared
      expect(screen.getByTestId('user-id')).toHaveTextContent('null');
      expect(locationSpy).toHaveBeenCalledWith('/');
    });

    it('handles logout error', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: 'user-123' }),
        })
        .mockRejectedValueOnce(new Error('Logout failed'));

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('user-id')).toHaveTextContent('user-123');
      });

      act(() => {
        screen.getByTestId('logout-btn').click();
      });

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          '[Auth] Logout failed:',
          expect.any(Error)
        );
      });
    });
  });
});
