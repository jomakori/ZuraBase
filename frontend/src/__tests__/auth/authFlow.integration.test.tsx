/**
 * Integration tests for complete authentication workflows
 */

import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/features/auth/context/AuthContext';
import { setupMockHandlers, cleanupMockHandlers } from '@/shared/fixtures/mockHandlers';

// Mock components for routing
const HomePage = () => {
  const auth = useAuth();
  const navigate = useNavigate();
  
  return (
    <div>
      <h1>Home</h1>
      {auth.user ? (
        <div>
          <span data-testid="welcome">Welcome {auth.user.name}</span>
          <button data-testid="logout-btn" onClick={auth.logout}>Logout</button>
        </div>
      ) : (
        <button data-testid="login-btn" onClick={auth.login}>Login</button>
      )}
      <button data-testid="go-to-protected" onClick={() => navigate('/protected')}>
        Go to Protected
      </button>
    </div>
  );
};

const ProtectedPage = () => {
  const auth = useAuth();
  
  if (auth.loading) {
    return <div data-testid="loading">Loading...</div>;
  }
  
  if (!auth.user) {
    return <div data-testid="unauthorized">Unauthorized</div>;
  }
  
  return (
    <div>
      <h1>Protected Page</h1>
      <div data-testid="protected-content">Secret content</div>
    </div>
  );
};

const App = () => {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/protected" element={<ProtectedPage />} />
      </Routes>
    </AuthProvider>
  );
};

// Mock fetch
global.fetch = jest.fn();

// Mock console methods
const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

describe('Authentication Flow Integration', () => {
  let user: ReturnType<typeof userEvent.setup>;
  
  beforeEach(() => {
    user = userEvent.setup();
    jest.clearAllMocks();
    setupMockHandlers();
    
    // Mock window.location.href for redirects
    Object.defineProperty(window, 'location', {
      value: { href: '', pathname: '/' },
      writable: true,
    });
  });
  
  afterEach(() => {
    cleanupMockHandlers();
  });
  
  describe('Complete login/logout flow', () => {
    it('allows user to login, access protected page, and logout', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'avatar.jpg',
      };
      
      // Mock user fetch on mount
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockUser),
      });
      
      render(
        <MemoryRouter>
          <App />
        </MemoryRouter>
      );
      
      // Wait for initial user fetch
      await waitFor(() => {
        expect(screen.getByTestId('welcome')).toBeInTheDocument();
      });
      
      expect(screen.getByTestId('welcome')).toHaveTextContent('Welcome Test User');
      
      // Navigate to protected page
      fireEvent.click(screen.getByTestId('go-to-protected'));
      
      // Should see protected content
      await waitFor(() => {
        expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      });
      
      // Go back home
      fireEvent.click(screen.getByText('Home'));
      
      // Logout
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
      });
      
      fireEvent.click(screen.getByTestId('logout-btn'));
      
      // Wait for logout to complete
      await waitFor(() => {
        expect(screen.getByTestId('login-btn')).toBeInTheDocument();
      });
      
      expect(screen.getByTestId('login-btn')).toBeInTheDocument();
      expect(screen.queryByTestId('welcome')).not.toBeInTheDocument();
    });
    
    it('redirects to home on logout error', async () => {
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
        .mockRejectedValueOnce(new Error('Logout failed'));
      
      render(
        <MemoryRouter>
          <App />
        </MemoryRouter>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('welcome')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByTestId('logout-btn'));
      
      // Should still redirect to home despite error
      await waitFor(() => {
        expect(window.location.href).toBe('/');
      });
    });
  });
  
  describe('Protected route access', () => {
    it('shows loading while checking authentication', async () => {
      // Delay the fetch response to test loading state
      let resolveFetch: (value: any) => void;
      const fetchPromise = new Promise((resolve) => {
        resolveFetch = resolve;
      });
      
      (global.fetch as jest.Mock).mockReturnValue(fetchPromise);
      
      render(
        <MemoryRouter initialEntries={['/protected']}>
          <App />
        </MemoryRouter>
      );
      
      // Should show loading initially
      expect(screen.getByTestId('loading')).toBeInTheDocument();
      
      // Resolve with user
      act(() => {
        resolveFetch!({
          ok: true,
          json: () => Promise.resolve({
            id: 'user-123',
            email: 'test@example.com',
            name: 'Test User',
            picture: 'avatar.jpg',
          }),
        });
      });
      
      await waitFor(() => {
        expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      });
    });
    
    it('shows unauthorized when user is not authenticated', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
      });
      
      render(
        <MemoryRouter initialEntries={['/protected']}>
          <App />
        </MemoryRouter>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('unauthorized')).toBeInTheDocument();
      });
    });
    
    it('allows access when user is authenticated', async () => {
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
        <MemoryRouter initialEntries={['/protected']}>
          <App />
        </MemoryRouter>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      });
    });
  });
  
  describe('Login redirect', () => {
    it('redirects to Google OAuth on login', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: false,
        status: 401,
      });
      
      render(
        <MemoryRouter>
          <App />
        </MemoryRouter>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('login-btn')).toBeInTheDocument();
      });
      
      const locationSpy = jest.spyOn(window.location, 'href', 'set');
      
      fireEvent.click(screen.getByTestId('login-btn'));
      
      expect(locationSpy).toHaveBeenCalledWith(
        expect.stringContaining('/auth/google')
      );
    });
  });
  
  describe('Session persistence', () => {
    it('maintains auth state across route changes', async () => {
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
        <MemoryRouter>
          <App />
        </MemoryRouter>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('welcome')).toBeInTheDocument();
      });
      
      // Navigate to protected and back
      fireEvent.click(screen.getByTestId('go-to-protected'));
      await waitFor(() => {
        expect(screen.getByTestId('protected-content')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByText('Home'));
      
      // User should still be authenticated
      expect(screen.getByTestId('welcome')).toBeInTheDocument();
    });
  });
});
