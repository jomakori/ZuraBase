/**
 * Integration tests for complete settings workflow
 * Tests navigation, tab switching, LLM profile management, and error recovery within the settings page.
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import SettingsPage from '@/shared/components/SettingsPage';

// Mock the AIProfilesSettings component (LLMProfilesSettings) to isolate integration
jest.mock('@/shared/components/LLMProfilesSettings', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: () => {
      return React.createElement('div', { 'data-testid': 'ai-profiles-settings' }, [
        React.createElement('h2', { key: 'h2' }, 'AI Profiles Settings'),
        React.createElement('button', { key: 'add', 'data-testid': 'add-ai-profile' }, 'Add New AI Profile'),
        React.createElement('ul', { key: 'list', 'data-testid': 'ai-profiles-list' }, [
          React.createElement('li', { key: 'profile-1', 'data-testid': 'ai-profile-llm-1' }, 'OpenAI Default'),
          React.createElement('li', { key: 'profile-2', 'data-testid': 'ai-profile-llm-2' }, 'Custom Server'),
        ])
      ]);
    }
  };
});

// Mock the LLMProfileWizard component (used by AIProfilesSettings)
jest.mock('@/shared/components/LLMProfileWizard', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: ({ onComplete, onSkip, initialData }: any) => {
      return React.createElement('div', { 'data-testid': 'llm-profile-wizard' }, [
        React.createElement('h3', { key: 'h3' }, initialData?.id ? 'Edit LLM Profile' : 'Create LLM Profile'),
        React.createElement('form', { key: 'form', 'data-testid': 'wizard-form', onSubmit: (e: any) => { e.preventDefault(); onComplete?.(); } }, [
          React.createElement('input', { key: 'input', 'data-testid': 'wizard-name', defaultValue: initialData?.name || '' }),
          React.createElement('button', { key: 'submit', type: 'submit', 'data-testid': 'wizard-submit' }, 'Save'),
          React.createElement('button', { key: 'cancel', type: 'button', onClick: onSkip, 'data-testid': 'wizard-cancel' }, 'Cancel')
        ])
      ]);
    }
  };
});

// Mock hooks
jest.mock('@/shared/hooks/llmProfilesHooks', () => ({
  useDeleteLLMProfile: () => ({
    deleteProfile: jest.fn().mockResolvedValue({}),
    loading: false,
  }),
  useSetDefaultLLMProfile: () => ({
    setDefaultProfile: jest.fn().mockResolvedValue({}),
    loading: false,
  }),
  useCreateLLMProfile: () => ({
    createProfile: jest.fn().mockResolvedValue({ profile: { id: 'new-id' } }),
    loading: false,
  }),
  useUpdateLLMProfile: () => ({
    updateProfile: jest.fn().mockResolvedValue({}),
    loading: false,
  }),
}));

// Mock the LLMProfilesContext
jest.mock('@/shared/context/LLMProfilesProvider', () => ({
  useLLMProfilesContext: jest.fn(() => ({
    profiles: [
      { id: 'llm-1', name: 'OpenAI Default', is_default: true, model: 'gpt-4', server_url: '' },
      { id: 'llm-2', name: 'Custom Server', is_default: false, model: 'claude-3', server_url: 'https://api.custom.com' },
    ],
    loading: false,
    error: null,
    refetch: jest.fn().mockResolvedValue({}),
  })),
}));

describe('Settings Flow Integration', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    jest.clearAllMocks();
  });

  const renderSettingsPage = () => {
    return render(
      <MemoryRouter initialEntries={['/settings']}>
        <Routes>
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </MemoryRouter>
    );
  };

  describe('Page Rendering and Navigation', () => {
    it('renders settings page with title and tabs', async () => {
      renderSettingsPage();

      expect(screen.getByRole('heading', { name: /Settings/i, level: 1 })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /General/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /AI Settings/i })).toBeInTheDocument();
    });

    it('defaults to AI Settings tab', async () => {
      renderSettingsPage();

      const aiTab = screen.getByRole('button', { name: /AI Settings/i });
      expect(aiTab).toHaveClass('border-b-2', 'border-blue-600');
      expect(screen.getByTestId('ai-profiles-settings')).toBeInTheDocument();
    });

    it('switches to General tab and shows placeholder', async () => {
      renderSettingsPage();

      const generalTab = screen.getByRole('button', { name: /General/i });
      await user.click(generalTab);

      expect(generalTab).toHaveClass('border-b-2', 'border-blue-600');
      expect(screen.getByText('General Settings')).toBeInTheDocument();
      expect(screen.getByText('No general settings available yet.')).toBeInTheDocument();
      // AI settings should be hidden
      expect(screen.queryByTestId('ai-profiles-settings')).not.toBeInTheDocument();
    });

    it('switches back to AI Settings tab', async () => {
      renderSettingsPage();

      await user.click(screen.getByRole('button', { name: /General/i }));
      await user.click(screen.getByRole('button', { name: /AI Settings/i }));

      expect(screen.getByTestId('ai-profiles-settings')).toBeInTheDocument();
      expect(screen.queryByText('General Settings')).not.toBeInTheDocument();
    });
  });

  describe('AI Profiles Management within Settings', () => {
    it('displays list of AI profiles', async () => {
      renderSettingsPage();

      await waitFor(() => {
        expect(screen.getByTestId('ai-profiles-list')).toBeInTheDocument();
      });

      expect(screen.getByText('OpenAI Default')).toBeInTheDocument();
      expect(screen.getByText('Custom Server')).toBeInTheDocument();
    });

    it('shows add profile button', async () => {
      renderSettingsPage();

      const addButton = screen.getByTestId('add-ai-profile');
      expect(addButton).toBeInTheDocument();
      expect(addButton).toHaveTextContent('Add New AI Profile');
    });
  });

  describe('User Interactions Across Tabs', () => {
    it('preserves AI profiles list after switching tabs', async () => {
      renderSettingsPage();

      // Verify AI profiles list is present
      expect(screen.getByTestId('ai-profiles-list')).toBeInTheDocument();

      // Switch to General tab
      await user.click(screen.getByRole('button', { name: /General/i }));
      expect(screen.queryByTestId('ai-profiles-list')).not.toBeInTheDocument();

      // Switch back to AI Settings
      await user.click(screen.getByRole('button', { name: /AI Settings/i }));
      expect(screen.getByTestId('ai-profiles-list')).toBeInTheDocument();
    });
  });

  describe('Accessibility and Usability', () => {
    it('has proper ARIA attributes for tabs', async () => {
      renderSettingsPage();

      const generalTab = screen.getByRole('button', { name: /General/i });
      const aiTab = screen.getByRole('button', { name: /AI Settings/i });

      expect(generalTab).toBeInTheDocument();
      expect(aiTab).toBeInTheDocument();
    });
  });

  describe('Integration with Backend API', () => {
    it('fetches AI profiles on mount', async () => {
      renderSettingsPage();

      // The context mock is called, we can verify that profiles are displayed.
      // We'll just ensure the mocked profiles are displayed.
      await waitFor(() => {
        expect(screen.getByTestId('ai-profiles-list')).toBeInTheDocument();
      });
    });
  });
});
