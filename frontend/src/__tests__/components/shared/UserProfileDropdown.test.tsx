/**
 * Tests for UserProfileDropdown component
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import UserProfileDropdown from '@/shared/components/UserProfileDropdown';

// Mock useNavigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

// Mock useAuth
jest.mock('@/features/auth/context/AuthContext', () => ({
  ...jest.requireActual('@/features/auth/context/AuthContext'),
  useAuth: jest.fn(),
}));

const mockUseAuth = require('@/features/auth/context/AuthContext').useAuth;

describe('UserProfileDropdown', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    picture: 'https://example.com/avatar.jpg',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderWithMockAuth = (user: any = mockUser, logout = jest.fn()) => {
    mockUseAuth.mockReturnValue({ user, logout });
    return render(
      <MemoryRouter>
        <UserProfileDropdown />
      </MemoryRouter>
    );
  };

  describe('Rendering', () => {
    it('renders nothing when user is null', () => {
      mockUseAuth.mockReturnValue({ user: null, logout: jest.fn() });
      const { container } = render(
        <MemoryRouter>
          <UserProfileDropdown />
        </MemoryRouter>
      );
      
      expect(container.firstChild).toBeNull();
    });

    it('renders profile button with user name and avatar when user exists', () => {
      renderWithMockAuth();
      
      const avatar = screen.getByAltText('Profile');
      expect(avatar).toBeInTheDocument();
      expect(avatar).toHaveAttribute('src', mockUser.picture);
      
      // Name is hidden on small screens but still present
      const nameElement = screen.getByText('Test');
      expect(nameElement).toBeInTheDocument();
    });

    it('does not show dropdown by default', () => {
      renderWithMockAuth();
      
      expect(screen.queryByText('Settings')).not.toBeInTheDocument();
      expect(screen.queryByText('Logout')).not.toBeInTheDocument();
    });
  });

  describe('Dropdown open/close behavior', () => {
    it('opens dropdown when profile button is clicked', () => {
      renderWithMockAuth();
      
      const profileButton = screen.getByRole('button');
      fireEvent.click(profileButton);
      
      expect(screen.getByText('Settings')).toBeInTheDocument();
      expect(screen.getByText('Logout')).toBeInTheDocument();
    });

    it('closes dropdown when clicking profile button again', () => {
      renderWithMockAuth();
      
      const profileButton = screen.getByRole('button');
      fireEvent.click(profileButton);
      expect(screen.getByText('Settings')).toBeInTheDocument();
      
      fireEvent.click(profileButton);
      expect(screen.queryByText('Settings')).not.toBeInTheDocument();
    });

    it('does not close dropdown when clicking outside (no click‑outside detection)', () => {
      renderWithMockAuth();
      
      const profileButton = screen.getByRole('button');
      fireEvent.click(profileButton);
      expect(screen.getByText('Settings')).toBeInTheDocument();
      
      fireEvent.click(document.body);
      expect(screen.getByText('Settings')).toBeInTheDocument();
    });
  });

  describe('Dropdown menu items', () => {
    it('displays user name and email in dropdown header', () => {
      renderWithMockAuth();
      fireEvent.click(screen.getByRole('button'));
      
      expect(screen.getByText(mockUser.name)).toBeInTheDocument();
      expect(screen.getByText(mockUser.email)).toBeInTheDocument();
    });

    it('has a Settings item that navigates to /settings', () => {
      renderWithMockAuth();
      fireEvent.click(screen.getByRole('button'));
      
      const settingsButton = screen.getByText('Settings');
      expect(settingsButton).toBeInTheDocument();
      
      fireEvent.click(settingsButton);
      expect(mockNavigate).toHaveBeenCalledWith('/settings');
    });

    it('closes dropdown after clicking Settings', () => {
      renderWithMockAuth();
      fireEvent.click(screen.getByRole('button'));
      
      const settingsButton = screen.getByText('Settings');
      fireEvent.click(settingsButton);
      
      expect(screen.queryByText('Settings')).not.toBeInTheDocument();
    });

    it('has a Logout item that calls logout function', () => {
      const logoutMock = jest.fn();
      mockUseAuth.mockReturnValue({ user: mockUser, logout: logoutMock });
      render(
        <MemoryRouter>
          <UserProfileDropdown />
        </MemoryRouter>
      );
      fireEvent.click(screen.getByRole('button'));
      
      const logoutButton = screen.getByText('Logout');
      fireEvent.click(logoutButton);
      
      expect(logoutMock).toHaveBeenCalledTimes(1);
    });

    it('calls logout function when Logout is clicked', () => {
      const logoutMock = jest.fn();
      mockUseAuth.mockReturnValue({ user: mockUser, logout: logoutMock });
      render(
        <MemoryRouter>
          <UserProfileDropdown />
        </MemoryRouter>
      );
      fireEvent.click(screen.getByRole('button'));
      
      const logoutButton = screen.getByText('Logout');
      fireEvent.click(logoutButton);
      
      expect(logoutMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('profile button is a button element', () => {
      renderWithMockAuth();
      
      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
    });

    it('dropdown menu items are buttons', () => {
      renderWithMockAuth();
      fireEvent.click(screen.getByRole('button'));
      
      const settingsButton = screen.getByText('Settings');
      expect(settingsButton.tagName).toBe('BUTTON');
      
      const logoutButton = screen.getByText('Logout');
      expect(logoutButton.tagName).toBe('BUTTON');
    });
  });
});
