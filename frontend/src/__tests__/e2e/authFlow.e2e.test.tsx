/**
 * E2E tests for authentication flow
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/features/auth/context/AuthContext';
import { setupMockHandlers, cleanupMockHandlers } from '@/shared/fixtures/mockHandlers';
import { mockUser } from '@/shared/fixtures/mockData';

// Mock components for routing
const HomePage = () => {
  const auth = useAuth();
  
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

describe('Authentication Flow E2E', () => {
  beforeEach(() => {
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
  
  describe('Login flow', () => {
    it('shows login button when user is not authenticated', async () => {
      // Mock fetch to return unauthorized (no user)
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
    });
    
    it('automatically logs in user if session exists', async () => {
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
      
      expect(screen.getByTestId('welcome')).toHaveTextContent(`Welcome ${mockUser.name}`);
    });
  });
  
  describe('Logout flow', () => {
    it('calls logout API when logout button is clicked', async () => {
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve(mockUser),
        })
        .mockResolvedValueOnce({
          ok: true,
        });
      
      render(
        <MemoryRouter>
          <App />
        </MemoryRouter>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('welcome')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByTestId('logout-btn'));
      
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/auth/logout'),
          expect.objectContaining({ method: 'POST', credentials: 'include' })
        );
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
      resolveFetch!({
        ok: true,
        json: () => Promise.resolve({
          id: 'user-123',
          email: 'test@example.com',
          name: 'Test User',
          picture: 'avatar.jpg',
        }),
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
      const mockAuthUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        picture: 'avatar.jpg',
      };
      
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockAuthUser),
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
  
  describe('Auth error recovery', () => {
    it('recovers from network error during user fetch', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));
      
      render(
        <MemoryRouter>
          <App />
        </MemoryRouter>
      );
      
      await waitFor(() => {
        expect(screen.getByTestId('login-btn')).toBeInTheDocument();
      });
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Auth] Failed to fetch user:',
        expect.any(Error)
      );
    });
  });
});
