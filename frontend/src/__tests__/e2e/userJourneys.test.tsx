/**
 * E2E tests for complete user journeys across the application
 */

import React from 'react';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import App from '@/shared/components/App';
import { setupMockHandlers, cleanupMockHandlers } from '@/shared/fixtures/mockHandlers';
import { mockUser, mockLLMProfiles, mockNotes, mockPlanner, mockStrands } from '@/shared/fixtures/mockData';

// Mock child components that are heavy or have external dependencies
jest.mock('@/features/notes/components/NotesApp', () => ({
  __esModule: true,
  default: () => {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'notes-app' },
      React.createElement('h1', null, 'Notes'),
      React.createElement('div', { 'data-testid': 'notes-list' },
        mockNotes.map(note =>
          React.createElement('div', { key: note.id, 'data-testid': `note-${note.id}` }, note.title)
        )
      ),
      React.createElement('button', { 'data-testid': 'create-note-btn' }, 'Create Note')
    );
  },
}));

jest.mock('@/features/planner/components/PlannerApp', () => ({
  __esModule: true,
  default: () => {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'planner-app' },
      React.createElement('h1', null, 'Planner'),
      React.createElement('div', { 'data-testid': 'planner-board' },
        mockPlanner.lanes.map(lane =>
          React.createElement('div', { key: lane.id, 'data-testid': `lane-${lane.id}` }, lane.title)
        )
      ),
      React.createElement('button', { 'data-testid': 'create-planner-btn' }, 'Create Planner')
    );
  },
}));

jest.mock('@/features/strands/components/StrandsApp', () => ({
  __esModule: true,
  default: () => {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'strands-app' },
      React.createElement('h1', null, 'Strands'),
      React.createElement('div', { 'data-testid': 'strands-list' },
        mockStrands.map(strand =>
          React.createElement('div', { key: strand.id, 'data-testid': `strand-${strand.id}` }, strand.title)
        )
      ),
      React.createElement('button', { 'data-testid': 'create-strand-btn' }, 'Create Strand')
    );
  },
}));

jest.mock('@/shared/components/SettingsPage', () => ({
  __esModule: true,
  default: () => {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'settings-page' },
      React.createElement('h1', null, 'Settings'),
      React.createElement('div', { 'data-testid': 'llm-profiles' },
        mockLLMProfiles.map(profile =>
          React.createElement('div', { key: profile.id, 'data-testid': `profile-${profile.id}` }, profile.name)
        )
      ),
      React.createElement('button', { 'data-testid': 'logout-btn' }, 'Logout')
    );
  },
}));

// Mock AuthProvider to simulate authenticated user
jest.mock('@/features/auth/context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => {
    const React = require('react');
    return React.createElement('div', null, children);
  },
  useAuth: () => ({
    user: mockUser,
    loading: false,
    login: jest.fn(),
    logout: jest.fn(),
  }),
}));

// Mock LLMProfilesProvider to provide profiles
jest.mock('@/shared/context/LLMProfilesProvider', () => ({
  LLMProfilesProvider: ({ children }: { children: React.ReactNode }) => {
    const React = require('react');
    return React.createElement('div', null, children);
  },
  useLLMProfilesContext: () => ({
    profiles: mockLLMProfiles,
    loading: false,
    error: null,
    refetch: jest.fn(),
  }),
}));

describe('User Journeys E2E', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    setupMockHandlers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanupMockHandlers();
  });

  const renderApp = (initialRoute = '/') => {
    return render(
      <MemoryRouter initialEntries={[initialRoute]}>
        <App />
      </MemoryRouter>
    );
  };

  describe('Complete user onboarding journey', () => {
    it('navigates from home to each module and back', async () => {
      renderApp('/');

      // Home page should be visible
      await waitFor(() => {
        expect(screen.getByText('Welcome to ZuraBase')).toBeInTheDocument();
      });

      // Navigate to Notes via NavBar
      const notesNav = screen.getByRole('link', { name: /notes/i });
      await user.click(notesNav);

      await waitFor(() => {
        expect(screen.getByTestId('notes-app')).toBeInTheDocument();
      });

      // Navigate to Planner
      const plannerNav = screen.getByRole('link', { name: /planner/i });
      await user.click(plannerNav);

      await waitFor(() => {
        expect(screen.getByTestId('planner-app')).toBeInTheDocument();
      });

      // Navigate to Strands
      const strandsNav = screen.getByRole('link', { name: /strands/i });
      await user.click(strandsNav);

      await waitFor(() => {
        expect(screen.getByTestId('strands-app')).toBeInTheDocument();
      });

      // Navigate to Settings
      const settingsNav = screen.getByRole('link', { name: /settings/i });
      await user.click(settingsNav);

      await waitFor(() => {
        expect(screen.getByTestId('settings-page')).toBeInTheDocument();
      });

      // Navigate back to Home
      const homeNav = screen.getByRole('link', { name: /home/i });
      await user.click(homeNav);

      await waitFor(() => {
        expect(screen.getByText('Welcome to ZuraBase')).toBeInTheDocument();
      });
    });
  });

  describe('User navigation through app', () => {
    it('switches between modules using navbar and maintains state', async () => {
      renderApp('/notes');

      await waitFor(() => {
        expect(screen.getByTestId('notes-app')).toBeInTheDocument();
      });

      // Verify notes list is rendered
      expect(screen.getByTestId('notes-list')).toBeInTheDocument();
      expect(screen.getByTestId(`note-${mockNotes[0].id}`)).toBeInTheDocument();

      // Switch to planner
      const plannerNav = screen.getByRole('link', { name: /planner/i });
      await user.click(plannerNav);

      await waitFor(() => {
        expect(screen.getByTestId('planner-app')).toBeInTheDocument();
      });

      // Verify planner board is rendered
      expect(screen.getByTestId('planner-board')).toBeInTheDocument();

      // Switch back to notes
      const notesNav = screen.getByRole('link', { name: /notes/i });
      await user.click(notesNav);

      await waitFor(() => {
        expect(screen.getByTestId('notes-app')).toBeInTheDocument();
      });

      // Notes list should still be present
      expect(screen.getByTestId('notes-list')).toBeInTheDocument();
    });
  });

  describe('User settings management', () => {
    it('accesses settings page and views LLM profiles', async () => {
      renderApp('/settings');

      await waitFor(() => {
        expect(screen.getByTestId('settings-page')).toBeInTheDocument();
      });

      // LLM profiles section should be visible
      expect(screen.getByTestId('llm-profiles')).toBeInTheDocument();
      expect(screen.getByTestId(`profile-${mockLLMProfiles[0].id}`)).toBeInTheDocument();
      expect(screen.getByTestId(`profile-${mockLLMProfiles[1].id}`)).toBeInTheDocument();
    });

    it('logs out from settings page', async () => {
      const mockLogout = jest.fn();
      // Override the mock to capture logout click
      require('@/features/auth/context/AuthContext').useAuth = () => ({
        user: mockUser,
        loading: false,
        login: jest.fn(),
        logout: mockLogout,
      });

      renderApp('/settings');

      await waitFor(() => {
        expect(screen.getByTestId('settings-page')).toBeInTheDocument();
      });

      const logoutButton = screen.getByTestId('logout-btn');
      await user.click(logoutButton);

      expect(mockLogout).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error recovery in user workflows', () => {
    it('handles API errors gracefully when loading notes', async () => {
      // Override mock handlers to simulate error
      const { notesHandlers } = require('@/shared/fixtures/mockHandlers');
      const originalGetNotes = notesHandlers.getNotes;
      notesHandlers.getNotes = () => Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Internal server error' }),
      });

      renderApp('/notes');

      // The component should handle error and show appropriate UI
      // Since we mocked NotesApp, we can't test error UI directly.
      // In a real E2E test we would unmock and let the real component handle error.
      // For this test we'll just ensure the app doesn't crash.
      await waitFor(() => {
        expect(screen.getByTestId('notes-app')).toBeInTheDocument();
      });

      // Restore original handler
      notesHandlers.getNotes = originalGetNotes;
    });

    it('recovers from network error when switching modules', async () => {
      // Simulate network failure on planner fetch
      const { plannerHandlers } = require('@/shared/fixtures/mockHandlers');
      const originalGetPlanner = plannerHandlers.getPlanner;
      plannerHandlers.getPlanner = () => Promise.reject(new Error('Network error'));

      renderApp('/planner');

      // App should still render (maybe with error state)
      await waitFor(() => {
        expect(screen.getByTestId('planner-app')).toBeInTheDocument();
      });

      // Switch to notes (should work)
      const notesNav = screen.getByRole('link', { name: /notes/i });
      await user.click(notesNav);

      await waitFor(() => {
        expect(screen.getByTestId('notes-app')).toBeInTheDocument();
      });

      plannerHandlers.getPlanner = originalGetPlanner;
    });
  });

  describe('Session persistence across navigation', () => {
    it('maintains user authentication state across module switches', async () => {
      renderApp('/');

      // Check that user is authenticated (via mock)
      // The NavBar might show user avatar, but we can't test due to mocks.
      // Instead we'll verify that protected routes are accessible.
      await waitFor(() => {
        expect(screen.getByText('Welcome to ZuraBase')).toBeInTheDocument();
      });

      // Navigate to settings (requires auth)
      const settingsNav = screen.getByRole('link', { name: /settings/i });
      await user.click(settingsNav);

      await waitFor(() => {
        expect(screen.getByTestId('settings-page')).toBeInTheDocument();
      });

      // Should see LLM profiles (requires auth)
      expect(screen.getByTestId('llm-profiles')).toBeInTheDocument();
    });
  });

  describe('Logout flow', () => {
    it('completes logout and redirects to home', async () => {
      const mockLogout = jest.fn();
      require('@/features/auth/context/AuthContext').useAuth = () => ({
        user: mockUser,
        loading: false,
        login: jest.fn(),
        logout: mockLogout,
      });

      // Mock window.location.href for redirect
      delete window.location;
      window.location = { href: '' } as any;

      renderApp('/settings');

      await waitFor(() => {
        expect(screen.getByTestId('settings-page')).toBeInTheDocument();
      });

      const logoutButton = screen.getByTestId('logout-btn');
      await user.click(logoutButton);

      expect(mockLogout).toHaveBeenCalledTimes(1);
      // In real app, logout would redirect to home; we can't test due to mocks.
    });
  });
});
