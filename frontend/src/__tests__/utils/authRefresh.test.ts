/**
 * Tests for authentication refresh utilities
 */

import { checkAuthSession, handleAuthError, getNetworkErrorMessage } from '@/shared/utils/authRefresh';

// Mock fetch
global.fetch = jest.fn();

// Mock console methods
const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

describe('authRefresh', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    document.body.innerHTML = '';
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('checkAuthSession', () => {
    it('returns true when session is valid', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
      });

      const result = await checkAuthSession();
      expect(result).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/user'),
        expect.objectContaining({ credentials: 'include' })
      );
    });

    it('returns false when session is invalid', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
      });

      const result = await checkAuthSession();
      expect(result).toBe(false);
    });

    it('returns false on network error', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const result = await checkAuthSession();
      expect(result).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to check authentication status:',
        expect.any(Error)
      );
    });
  });

  describe('handleAuthError', () => {
    it('returns false for non-401 status', async () => {
      const result = await handleAuthError(403);
      expect(result).toBe(false);
    });

    it('handles 401 status and creates warning message', async () => {
      const result = await handleAuthError(401);
      expect(result).toBe(true);
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Session expired — preventing redirect loop'
      );

      // Check that localStorage and sessionStorage are cleared
      expect(localStorage.getItem('auth_token')).toBeNull();
      
      // Check that warning message was added to DOM
      const warningMessage = document.getElementById('session-expired-warning');
      expect(warningMessage).not.toBeNull();
      expect(warningMessage?.textContent).toContain('Your session has expired');
    });

    it('prevents multiple redirect loops when already refreshing', async () => {
      // First call sets isRefreshingAuth to true
      const firstResult = await handleAuthError(401);
      expect(firstResult).toBe(true);

      // Second call should also return true (already refreshing)
      const secondResult = await handleAuthError(401);
      expect(secondResult).toBe(true);
    });

    it('does not create duplicate warning messages', async () => {
      // Create first warning
      await handleAuthError(401);
      const firstWarning = document.getElementById('session-expired-warning');
      expect(firstWarning).not.toBeNull();

      // Reset isRefreshingAuth flag
      (handleAuthError as any).isRefreshingAuth = false;

      // Call again
      await handleAuthError(401);
      const warnings = document.querySelectorAll('#session-expired-warning');
      expect(warnings.length).toBe(1);
    });

    it('redirects to home page after delay', async () => {
      jest.useFakeTimers();
      
      // Mock window.location.href
      Object.defineProperty(window, 'location', {
        value: { href: '/notes', pathname: '/notes' },
        writable: true,
      });

      await handleAuthError(401);
      
      // Fast-forward timers
      jest.advanceTimersByTime(4000);
      
      expect(window.location.href).toBe('/');
      
      // Restore
      Object.defineProperty(window, 'location', {
        value: { href: '', pathname: '' },
        writable: true,
      });
      jest.useRealTimers();
    });

    it('does not redirect if already on home page', async () => {
      jest.useFakeTimers();
      
      Object.defineProperty(window, 'location', {
        value: { href: '/', pathname: '/' },
        writable: true,
      });

      const locationSpy = jest.spyOn(window.location, 'href', 'set');

      await handleAuthError(401);
      jest.advanceTimersByTime(4000);
      
      expect(locationSpy).not.toHaveBeenCalled();
      
      jest.useRealTimers();
    });
  });

  describe('getNetworkErrorMessage', () => {
    it('returns default message for null error', () => {
      const result = getNetworkErrorMessage(null);
      expect(result).toBe('An unknown error occurred');
    });

    it('returns error message string', () => {
      const error = new Error('Custom error');
      const result = getNetworkErrorMessage(error);
      expect(result).toBe('Custom error');
    });

    it('returns server unavailable message for fetch errors', () => {
      const error = new Error('Failed to fetch');
      const result = getNetworkErrorMessage(error);
      expect(result).toBe(
        'The server is temporarily unavailable. Your changes will be saved when the connection is restored.'
      );
    });

    it('returns server unavailable message for connection refused', () => {
      const error = new Error('net::ERR_CONNECTION_REFUSED');
      const result = getNetworkErrorMessage(error);
      expect(result).toBe(
        'The server is temporarily unavailable. Your changes will be saved when the connection is restored.'
      );
    });

    it('returns network error message for NetworkError', () => {
      const error = new Error('NetworkError');
      const result = getNetworkErrorMessage(error);
      expect(result).toBe('Network error. Please check your internet connection.');
    });

    it('returns timeout message', () => {
      const error = new Error('timeout');
      const result = getNetworkErrorMessage(error);
      expect(result).toBe('The request timed out. The server might be under heavy load.');
    });

    it('handles string errors', () => {
      const result = getNetworkErrorMessage('String error');
      expect(result).toBe('String error');
    });
  });
});
