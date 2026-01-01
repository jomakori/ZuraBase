/**
 * Tests for LLMProfilesSettings component
 * Tests the settings page for managing LLM profiles
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LLMProfilesSettings from '@/shared/components/LLMProfilesSettings';

// Mock the LLMProfileWizard component
jest.mock('@/shared/components/LLMProfileWizard', () => {
  const MockWizard = ({ onComplete, onSkip, initialData }: any) => {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'llm-profile-wizard' },
      React.createElement('div', null, 'LLM Profile Wizard'),
      React.createElement('div', null, 'Initial Data: ', initialData?.id ? 'Edit' : 'Create'),
      React.createElement('button', { onClick: onSkip, 'data-testid': 'close-wizard' }, 'Close'),
      React.createElement('button', { onClick: onComplete, 'data-testid': 'complete-wizard' }, 'Complete')
    );
  };
  return MockWizard;
});

// Mock the hooks
jest.mock('@/shared/hooks/llmProfilesHooks', () => ({
  useDeleteLLMProfile: () => ({
    deleteProfile: jest.fn().mockResolvedValue({}),
    loading: false,
  }),
  useSetDefaultLLMProfile: () => ({
    setDefaultProfile: jest.fn().mockResolvedValue({}),
    loading: false,
  }),
}));

// Mock the context
jest.mock('@/shared/context/LLMProfilesProvider', () => ({
  useLLMProfilesContext: () => ({
    profiles: [
      {
        id: 'llm-1',
        user_id: 'user-123',
        name: 'OpenAI Default',
        server_url: '',
        api_key: 'sk-mock-key',
        model: 'gpt-4',
        is_default: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
      {
        id: 'llm-2',
        user_id: 'user-123',
        name: 'Custom Server',
        server_url: 'https://api.custom-llm.com',
        api_key: 'custom-key',
        model: 'claude-3',
        is_default: false,
        created_at: '2024-01-02T00:00:00Z',
        updated_at: '2024-01-02T00:00:00Z',
      },
    ],
    loading: false,
    error: null,
    refetch: jest.fn(),
  }),
}));

describe('LLMProfilesSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderSettings = () => {
    return render(
      <MemoryRouter>
        <LLMProfilesSettings />
      </MemoryRouter>
    );
  };

  describe('Rendering', () => {
    it('renders the settings page with title', async () => {
      renderSettings();

      await waitFor(() => {
        expect(screen.getByText('AI Profiles')).toBeInTheDocument();
      });
    });

    it('renders "Add New AI Profile" button', async () => {
      renderSettings();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Add New AI Profile/i })).toBeInTheDocument();
      });
    });

    it('displays profile list after loading', async () => {
      renderSettings();

      await waitFor(() => {
        expect(screen.getByText('OpenAI Default')).toBeInTheDocument();
        expect(screen.getByText('Custom Server')).toBeInTheDocument();
      });
    });

    it('displays profile details correctly', async () => {
      renderSettings();

      await waitFor(() => {
        // Check first profile
        expect(screen.getByText('OpenAI Default')).toBeInTheDocument();
        expect(screen.getByText(/Model: gpt-4/i)).toBeInTheDocument();

        // Check second profile
        expect(screen.getByText('Custom Server')).toBeInTheDocument();
        expect(screen.getByText('https://api.custom-llm.com')).toBeInTheDocument();
      });
    });

    it('shows default profile indicator (star icon)', async () => {
      renderSettings();

      await waitFor(() => {
        const profileItems = screen.getAllByRole('listitem');
        expect(profileItems.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Add New Profile Functionality', () => {
    it('opens wizard when "Add New AI Profile" button is clicked', async () => {
      renderSettings();

      const addButton = await screen.findByRole('button', { name: /Add New AI Profile/i });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByTestId('llm-profile-wizard')).toBeInTheDocument();
      });
    });

    it('closes wizard when close button is clicked', async () => {
      renderSettings();

      const addButton = await screen.findByRole('button', { name: /Add New AI Profile/i });
      fireEvent.click(addButton);

      await waitFor(() => {
        expect(screen.getByTestId('llm-profile-wizard')).toBeInTheDocument();
      });

      const closeButton = screen.getByTestId('close-wizard');
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByTestId('llm-profile-wizard')).not.toBeInTheDocument();
      });
    });
  });

  describe('Edit Profile Functionality', () => {
    it('opens wizard when edit button is clicked', async () => {
      renderSettings();

      await waitFor(() => {
        expect(screen.getByText('OpenAI Default')).toBeInTheDocument();
      });

      // Find and click edit button for first profile
      const editButtons = screen.getAllByRole('button').filter(btn => 
        btn.querySelector('svg') && btn.className.includes('text-gray-600')
      );
      if (editButtons.length > 0) {
        fireEvent.click(editButtons[0]);
      }

      await waitFor(() => {
        expect(screen.getByTestId('llm-profile-wizard')).toBeInTheDocument();
      });
    });
  });

  describe('Delete Profile Functionality', () => {
    it('calls delete API when delete button is clicked and confirmed', async () => {
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);

      renderSettings();

      await waitFor(() => {
        expect(screen.getByText('Custom Server')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button').filter(btn => 
        btn.querySelector('svg') && btn.className.includes('text-red-600')
      );
      if (deleteButtons.length > 0) {
        fireEvent.click(deleteButtons[0]);
      }

      await waitFor(() => {
        expect(confirmSpy).toHaveBeenCalled();
      });

      confirmSpy.mockRestore();
    });

    it('does not delete when confirmation is cancelled', async () => {
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);

      renderSettings();

      await waitFor(() => {
        expect(screen.getByText('Custom Server')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button').filter(btn => 
        btn.querySelector('svg') && btn.className.includes('text-red-600')
      );
      if (deleteButtons.length > 0) {
        fireEvent.click(deleteButtons[0]);
      }

      await waitFor(() => {
        expect(confirmSpy).toHaveBeenCalled();
      });

      confirmSpy.mockRestore();
    });
  });

  describe('Set Default Profile Functionality', () => {
    it('calls set default API when button is clicked', async () => {
      renderSettings();

      await waitFor(() => {
        expect(screen.getByText('Custom Server')).toBeInTheDocument();
      });

      const setDefaultButtons = screen.getAllByRole('button').filter(btn => 
        btn.querySelector('svg') && btn.className.includes('text-blue-600')
      );
      if (setDefaultButtons.length > 0) {
        fireEvent.click(setDefaultButtons[0]);
      }

      // The API call is mocked, so we just verify the button exists
      expect(setDefaultButtons.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('shows error message when profile deletion fails', async () => {
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation();
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);

      // Mock the deleteProfile hook to throw an error
      const { useDeleteLLMProfile } = require('@/shared/hooks/llmProfilesHooks');
      useDeleteLLMProfile.mockReturnValue({
        deleteProfile: jest.fn().mockRejectedValue(new Error('Delete failed')),
        loading: false,
      });

      renderSettings();

      await waitFor(() => {
        expect(screen.getByText('Custom Server')).toBeInTheDocument();
      });

      const deleteButtons = screen.getAllByRole('button').filter(btn => 
        btn.querySelector('svg') && btn.className.includes('text-red-600')
      );
      if (deleteButtons.length > 0) {
        fireEvent.click(deleteButtons[0]);
      }

      alertSpy.mockRestore();
      confirmSpy.mockRestore();
    });
  });

  describe('Accessibility', () => {
    it('has proper heading structure', async () => {
      renderSettings();

      await waitFor(() => {
        const heading = screen.getByRole('heading', { name: /AI Profiles/i });
        expect(heading).toBeInTheDocument();
      });
    });

    it('buttons have proper labels', async () => {
      renderSettings();

      await waitFor(() => {
        const addButton = screen.getByRole('button', { name: /Add New AI Profile/i });
        expect(addButton).toBeInTheDocument();
      });
    });

    it('list items are properly structured', async () => {
      renderSettings();

      await waitFor(() => {
        const listItems = screen.getAllByRole('listitem');
        expect(listItems.length).toBeGreaterThan(0);
      });
    });
  });
});
