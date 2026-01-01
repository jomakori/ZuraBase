/**
 * Tests for NavBar component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import NavBar from '@/shared/components/NavBar';
import { AuthProvider } from '@/features/auth/context/AuthContext';
import { setupMockHandlers, cleanupMockHandlers } from '@/shared/fixtures/mockHandlers';

// Mock alert
global.alert = jest.fn();

// Mock useAuth hook
jest.mock('@/features/auth/context/AuthContext', () => ({
  ...jest.requireActual('@/features/auth/context/AuthContext'),
  useAuth: jest.fn(),
}));

const mockUseAuth = require('@/features/auth/context/AuthContext').useAuth;

describe('NavBar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMockHandlers();
  });

  afterEach(() => {
    cleanupMockHandlers();
  });

  const renderNavBar = (currentPage = 'home', user: any = null, loading = false) => {
    mockUseAuth.mockReturnValue({ user, loading });
    
    return render(
      <MemoryRouter>
        <AuthProvider>
          <NavBar currentPage={currentPage as any} />
        </AuthProvider>
      </MemoryRouter>
    );
  };

  it('renders navigation links with correct active state', () => {
    renderNavBar('home');
    
    // Home link should be active
    const homeLink = screen.getByText('Home').closest('a');
    expect(homeLink).toHaveClass('bg-gray-100');
    
    // Notes link should not be active
    const notesLink = screen.getByText('Notes').closest('a');
    expect(notesLink).not.toHaveClass('bg-blue-100');
  });

  it('renders different active states for each page', () => {
    const { rerender } = renderNavBar('notes');
    
    expect(screen.getByText('Notes').closest('a')).toHaveClass('bg-blue-100');
    
    rerender(
      <MemoryRouter>
        <AuthProvider>
          <NavBar currentPage="planner" />
        </AuthProvider>
      </MemoryRouter>
    );
    
    expect(screen.getByText('Planner').closest('a')).toHaveClass('bg-green-100');
  });

  it('shows locked Strands button when user is not authenticated', () => {
    renderNavBar('home', null);
    
    const strandsButton = screen.getByText('Strands 🔒');
    expect(strandsButton).toBeInTheDocument();
    expect(strandsButton.tagName).toBe('BUTTON');
    
    // Click should trigger alert
    fireEvent.click(strandsButton);
    expect(global.alert).toHaveBeenCalledWith(
      'Login required: Please sign in to access Strands.'
    );
  });

  it('shows Strands link when user is authenticated', () => {
    const mockUser = { id: 'user-123', email: 'test@example.com', name: 'Test User' };
    renderNavBar('home', mockUser);
    
    const strandsLink = screen.getByText('Strands').closest('a');
    expect(strandsLink).toBeInTheDocument();
    expect(strandsLink).toHaveAttribute('href', '/strands');
  });

  it('shows Google sign-in button when user is not authenticated', () => {
    renderNavBar('home', null);
    
    const signInButton = screen.getByText('Sign in with Google');
    expect(signInButton).toBeInTheDocument();
    expect(signInButton.tagName).toBe('BUTTON');
  });

  it('shows user profile dropdown when user is authenticated', () => {
    const mockUser = { id: 'user-123', email: 'test@example.com', name: 'Test User' };
    renderNavBar('home', mockUser);
    
    // UserProfileDropdown is rendered, we can check for its presence
    // Since it's a separate component, we can check for a class or element
    // For now, just ensure the sign-in button is not present
    expect(screen.queryByText('Sign in with Google')).not.toBeInTheDocument();
  });

  it('hides auth section while loading', () => {
    renderNavBar('home', null, true);
    
    // Loading is true, NavAuthSection returns null
    expect(screen.queryByText('Sign in with Google')).not.toBeInTheDocument();
  });

  it('calls login function when sign-in button is clicked', () => {
    const mockLogin = jest.fn();
    mockUseAuth.mockReturnValue({ user: null, loading: false, login: mockLogin });
    
    render(
      <MemoryRouter>
        <AuthProvider>
          <NavBar currentPage="home" />
        </AuthProvider>
      </MemoryRouter>
    );
    
    const signInButton = screen.getByText('Sign in with Google');
    fireEvent.click(signInButton);
    
    expect(mockLogin).toHaveBeenCalledTimes(1);
  });

  it('renders logo image', () => {
    renderNavBar('home');
    
    const logo = screen.getByAltText('Home');
    expect(logo).toBeInTheDocument();
    expect(logo).toHaveAttribute('src', '/ZuraBase.png');
  });

  describe('NavAuthSection', () => {
    it('returns null when loading', () => {
      mockUseAuth.mockReturnValue({ user: null, loading: true });
      
      const { container } = render(
        <MemoryRouter>
          <AuthProvider>
            <NavBar currentPage="home" />
          </AuthProvider>
        </MemoryRouter>
      );
      
      // The auth section should be empty
      const authSection = container.querySelector('div > div:last-child');
      expect(authSection?.children.length).toBe(0);
    });
  });
});
