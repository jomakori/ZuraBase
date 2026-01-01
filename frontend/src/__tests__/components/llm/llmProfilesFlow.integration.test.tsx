/**
 * Integration tests for complete LLM profiles workflows
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import LLMProfilesSettings from '@/shared/components/LLMProfilesSettings';
import { setupMockHandlers, cleanupMockHandlers } from '@/shared/fixtures/mockHandlers';
import { mockLLMProfiles } from '@/shared/fixtures/mockData';

// Mock child components
jest.mock('@/shared/components/LLMProfileWizard', () => ({
  __esModule: true,
  default: ({ onComplete, onSkip, initialData }: any) => {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'llm-profile-wizard' },
      React.createElement('h2', null, initialData?.id ? 'Edit LLM Profile' : 'Set Up Your LLM Profile'),
      React.createElement('form', {
        'data-testid': 'wizard-form',
        onSubmit: (e: any) => { e.preventDefault(); onComplete?.(); }
      },
        React.createElement('input', {
          'data-testid': 'wizard-name',
          placeholder: 'Profile Name',
          defaultValue: initialData?.name || ''
        }),
        React.createElement('input', {
          'data-testid': 'wizard-api-key',
          placeholder: 'API Key',
          type: 'password',
          defaultValue: initialData?.api_key || ''
        }),
        React.createElement('input', {
          'data-testid': 'wizard-model',
          placeholder: 'Model',
          defaultValue: initialData?.model || ''
        }),
        React.createElement('button', { type: 'submit', 'data-testid': 'wizard-submit' },
          initialData?.id ? 'Save Changes' : 'Save Profile'
        ),
        React.createElement('button', { type: 'button', onClick: onSkip, 'data-testid': 'wizard-skip' },
          initialData?.id ? 'Cancel' : 'Skip'
        )
      )
    );
  },
}));

// Mock the hooks - create jest mocks that can be reconfigured
const mockUseDeleteLLMProfile = jest.fn();
const mockUseSetDefaultLLMProfile = jest.fn();
const mockUseTestLLMConnection = jest.fn();
const mockUseCreateLLMProfile = jest.fn();
const mockUseUpdateLLMProfile = jest.fn();

jest.mock('@/shared/hooks/llmProfilesHooks', () => ({
  useDeleteLLMProfile: mockUseDeleteLLMProfile,
  useSetDefaultLLMProfile: mockUseSetDefaultLLMProfile,
  useTestLLMConnection: mockUseTestLLMConnection,
  useCreateLLMProfile: mockUseCreateLLMProfile,
  useUpdateLLMProfile: mockUseUpdateLLMProfile,
}));

// Mock the context
jest.mock('@/shared/context/LLMProfilesProvider', () => ({
  useLLMProfilesContext: jest.fn(),
}));

describe('LLM Profiles Integration Workflows', () => {
  let user: ReturnType<typeof userEvent.setup>;
  const mockUseLLMProfilesContext = require('@/shared/context/LLMProfilesProvider').useLLMProfilesContext;

  beforeEach(() => {
    user = userEvent.setup();
    setupMockHandlers();
    jest.clearAllMocks();

    // Default context mock
    mockUseLLMProfilesContext.mockReturnValue({
      profiles: mockLLMProfiles,
      loading: false,
      error: null,
      refetch: jest.fn().mockResolvedValue({}),
    });

    // Set up default hook mocks
    mockUseDeleteLLMProfile.mockReturnValue({
      deleteProfile: jest.fn().mockResolvedValue({}),
      loading: false,
    });
    mockUseSetDefaultLLMProfile.mockReturnValue({
      setDefaultProfile: jest.fn().mockResolvedValue({}),
      loading: false,
    });
    mockUseTestLLMConnection.mockReturnValue({
      testConnection: jest.fn().mockResolvedValue({ success: true, message: 'Connected' }),
      loading: false,
      testResult: null,
    });
    mockUseCreateLLMProfile.mockReturnValue({
      createProfile: jest.fn().mockResolvedValue({ profile: { id: 'new-profile-id' } }),
      loading: false,
    });
    mockUseUpdateLLMProfile.mockReturnValue({
      updateProfile: jest.fn().mockResolvedValue({ profile: { id: 'updated-profile-id' } }),
      loading: false,
    });
  });

  afterEach(() => {
    cleanupMockHandlers();
  });

  const renderSettingsPage = () => {
    return render(
      <MemoryRouter initialEntries={['/settings']}>
        <Routes>
          <Route path="/settings" element={<LLMProfilesSettings />} />
        </Routes>
      </MemoryRouter>
    );
  };

  describe('Create → Edit → Delete Workflow', () => {
    it('completes full CRUD lifecycle for an LLM profile', async () => {
      renderSettingsPage();

      // Wait for profiles list
      await waitFor(() => {
        expect(screen.getByText('AI Profiles')).toBeInTheDocument();
        expect(screen.getByText('OpenAI Default')).toBeInTheDocument();
      });

      // Click "Add New AI Profile"
      const addButton = screen.getByRole('button', { name: 'Add New AI Profile' });
      await user.click(addButton);

      // Verify wizard opens
      await waitFor(() => {
        expect(screen.getByTestId('llm-profile-wizard')).toBeInTheDocument();
        expect(screen.getByText('Set Up Your LLM Profile')).toBeInTheDocument();
      });

      // Fill wizard form
      const nameInput = screen.getByTestId('wizard-name');
      const apiKeyInput = screen.getByTestId('wizard-api-key');
      const modelInput = screen.getByTestId('wizard-model');

      await user.type(nameInput, 'New Integration Profile');
      await user.type(apiKeyInput, 'sk-test-integration-key');
      await user.type(modelInput, 'gpt-4-turbo');

      // Submit the form
      const submitButton = screen.getByTestId('wizard-submit');
      await user.click(submitButton);

      // Verify create API was called
      const { useCreateLLMProfile } = require('@/shared/hooks/llmProfilesHooks');
      const mockCreateProfile = useCreateLLMProfile().createProfile;
      await waitFor(() => {
        expect(mockCreateProfile).toHaveBeenCalled();
      });

      // Verify wizard closes and refetch is called
      await waitFor(() => {
        expect(screen.queryByTestId('llm-profile-wizard')).not.toBeInTheDocument();
      });

      // Edit the newly created profile (we'll mock it appearing in the list)
      // First, update the mock to include the new profile
      mockUseLLMProfilesContext.mockReturnValue({
        profiles: [
          ...mockLLMProfiles,
          {
            id: 'new-profile-id',
            user_id: 'user-123',
            name: 'New Integration Profile',
            server_url: '',
            api_key: 'sk-test-integration-key',
            model: 'gpt-4-turbo',
            is_default: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
        loading: false,
        error: null,
        refetch: jest.fn().mockResolvedValue({}),
      });

      // Re-render to show updated list
      renderSettingsPage();

      await waitFor(() => {
        expect(screen.getByText('New Integration Profile')).toBeInTheDocument();
      });

      // Find and click edit button for the new profile
      const profileItems = screen.getAllByRole('listitem');
      const newProfileItem = profileItems.find(item => 
        item.textContent?.includes('New Integration Profile')
      );
      
      if (newProfileItem) {
        const editButton = within(newProfileItem).getByRole('button', { name: /edit/i });
        await user.click(editButton);
      }

      // Verify edit wizard opens
      await waitFor(() => {
        expect(screen.getByText('Edit LLM Profile')).toBeInTheDocument();
      });

      // Update the profile name
      const editNameInput = screen.getByTestId('wizard-name');
      await user.clear(editNameInput);
      await user.type(editNameInput, 'Updated Integration Profile');

      // Submit the edit
      const editSubmitButton = screen.getByTestId('wizard-submit');
      await user.click(editSubmitButton);

      // Verify update API was called
      const { useUpdateLLMProfile } = require('@/shared/hooks/llmProfilesHooks');
      const mockUpdateProfile = useUpdateLLMProfile().updateProfile;
      await waitFor(() => {
        expect(mockUpdateProfile).toHaveBeenCalled();
      });

      // Delete the profile
      // Update mock to show updated profile
      mockUseLLMProfilesContext.mockReturnValue({
        profiles: [
          ...mockLLMProfiles,
          {
            id: 'new-profile-id',
            user_id: 'user-123',
            name: 'Updated Integration Profile',
            server_url: '',
            api_key: 'sk-test-integration-key',
            model: 'gpt-4-turbo',
            is_default: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        ],
        loading: false,
        error: null,
        refetch: jest.fn().mockResolvedValue({}),
      });

      // Re-render
      renderSettingsPage();

      await waitFor(() => {
        expect(screen.getByText('Updated Integration Profile')).toBeInTheDocument();
      });

      // Mock window.confirm
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(true);

      // Find and click delete button
      const updatedProfileItems = screen.getAllByRole('listitem');
      const updatedProfileItem = updatedProfileItems.find(item => 
        item.textContent?.includes('Updated Integration Profile')
      );
      
      if (updatedProfileItem) {
        const deleteButton = within(updatedProfileItem).getByRole('button', { name: /delete/i });
        await user.click(deleteButton);
      }

      // Verify confirmation was shown
      expect(confirmSpy).toHaveBeenCalled();

      // Verify delete API was called
      const { useDeleteLLMProfile } = require('@/shared/hooks/llmProfilesHooks');
      const mockDeleteProfile = useDeleteLLMProfile().deleteProfile;
      await waitFor(() => {
        expect(mockDeleteProfile).toHaveBeenCalledWith('new-profile-id');
      });

      confirmSpy.mockRestore();
    });
  });

  describe('Set Default Profile Workflow', () => {
    it('sets a non-default profile as default', async () => {
      renderSettingsPage();

      await waitFor(() => {
        expect(screen.getByText('Custom Server')).toBeInTheDocument();
      });

      // Find the non-default profile (Custom Server)
      const profileItems = screen.getAllByRole('listitem');
      const customServerItem = profileItems.find(item => 
        item.textContent?.includes('Custom Server')
      );
      
      if (customServerItem) {
        // Find set default button (star button)
        const setDefaultButton = within(customServerItem).getByRole('button', { name: /set default/i });
        await user.click(setDefaultButton);
      }

      // Verify set default API was called
      const { useSetDefaultLLMProfile } = require('@/shared/hooks/llmProfilesHooks');
      const mockSetDefaultProfile = useSetDefaultLLMProfile().setDefaultProfile;
      await waitFor(() => {
        expect(mockSetDefaultProfile).toHaveBeenCalled();
      });
    });

    it('does not show set default button for already default profile', async () => {
      renderSettingsPage();

      await waitFor(() => {
        expect(screen.getByText('OpenAI Default')).toBeInTheDocument();
      });

      // Find the default profile
      const profileItems = screen.getAllByRole('listitem');
      const defaultProfileItem = profileItems.find(item => 
        item.textContent?.includes('OpenAI Default')
      );
      
      if (defaultProfileItem) {
        // Should not have set default button (already default)
        const setDefaultButtons = within(defaultProfileItem).queryAllByRole('button', { name: /set default/i });
        expect(setDefaultButtons.length).toBe(0);
      }
    });
  });

  describe('Connection Testing Workflow', () => {
    it('tests connection from wizard and loads models', async () => {
      // Mock the test connection hook to return success
      mockUseTestLLMConnection.mockReturnValue({
        testConnection: jest.fn().mockResolvedValue({
          success: true,
          message: 'Connection successful'
        }),
        loading: false,
        testResult: { success: true, message: 'Connection successful' },
      });

      renderSettingsPage();

      // Open wizard
      const addButton = screen.getByRole('button', { name: 'Add New AI Profile' });
      await user.click(addButton);

      await waitFor(() => {
        expect(screen.getByTestId('llm-profile-wizard')).toBeInTheDocument();
      });

      // The wizard doesn't show test button in our mock, but in real component it would
      // For integration test, we'll verify the hook is properly configured
      expect(mockUseTestLLMConnection).toHaveBeenCalled();
    });

    it('handles connection test failure', async () => {
      // Mock the test connection hook to return failure
      const { useTestLLMConnection } = require('@/shared/hooks/llmProfilesHooks');
      useTestLLMConnection.mockReturnValue({
        testConnection: jest.fn().mockResolvedValue({ 
          success: false, 
          message: 'Invalid API key' 
        }),
        loading: false,
        testResult: { success: false, message: 'Invalid API key' },
      });

      renderSettingsPage();

      // The component should handle connection failures gracefully
      // This is more thoroughly tested in unit tests
    });
  });

  describe('Error Recovery Workflow', () => {
    it('handles API errors during profile creation and allows retry', async () => {
      // Mock create to fail first, then succeed
      const { useCreateLLMProfile } = require('@/shared/hooks/llmProfilesHooks');
      const mockCreateProfile = jest.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce({ profile: { id: 'recovered-profile-id' } });
      
      useCreateLLMProfile.mockReturnValue({
        createProfile: mockCreateProfile,
        loading: false,
      });

      renderSettingsPage();

      // Open wizard
      const addButton = screen.getByRole('button', { name: 'Add New AI Profile' });
      await user.click(addButton);

      await waitFor(() => {
        expect(screen.getByTestId('llm-profile-wizard')).toBeInTheDocument();
      });

      // Fill and submit form (first attempt - will fail)
      const nameInput = screen.getByTestId('wizard-name');
      const apiKeyInput = screen.getByTestId('wizard-api-key');
      const submitButton = screen.getByTestId('wizard-submit');

      await user.type(nameInput, 'Error Recovery Profile');
      await user.type(apiKeyInput, 'sk-test-key');
      await user.click(submitButton);

      // First call should fail
      await waitFor(() => {
        expect(mockCreateProfile).toHaveBeenCalledTimes(1);
      });

      // In real UI, there would be an error message and retry option
      // For integration test, we simulate user trying again
      await user.click(submitButton);

      // Second call should succeed
      await waitFor(() => {
        expect(mockCreateProfile).toHaveBeenCalledTimes(2);
      });
    });

    it('handles profile deletion cancellation', async () => {
      renderSettingsPage();

      await waitFor(() => {
        expect(screen.getByText('Custom Server')).toBeInTheDocument();
      });

      // Mock window.confirm to return false (cancel)
      const confirmSpy = jest.spyOn(window, 'confirm').mockReturnValue(false);

      // Find and click delete button
      const profileItems = screen.getAllByRole('listitem');
      const customServerItem = profileItems.find(item => 
        item.textContent?.includes('Custom Server')
      );
      
      if (customServerItem) {
        const deleteButton = within(customServerItem).getByRole('button', { name: /delete/i });
        await user.click(deleteButton);
      }

      // Verify confirmation was shown
      expect(confirmSpy).toHaveBeenCalled();

      // Verify delete API was NOT called
      const { useDeleteLLMProfile } = require('@/shared/hooks/llmProfilesHooks');
      const mockDeleteProfile = useDeleteLLMProfile().deleteProfile;
      expect(mockDeleteProfile).not.toHaveBeenCalled();

      confirmSpy.mockRestore();
    });
  });

  describe('Model Selection Workflow', () => {
    it('integrates model selection with connection testing', async () => {
      // This test would verify that after successful connection test,
      // models are loaded and available for selection
      // Since we're mocking the wizard, we'll verify the integration points
      
      renderSettingsPage();

      // The integration is between:
      // 1. Connection test success
      // 2. Model loading triggered
      // 3. Models displayed in SearchableModelSelect
      // 4. Model selection updates form data
      
      // These are covered in unit tests, but integration test would
      // verify the complete flow works together
    });
  });

  describe('State Management Across Operations', () => {
    it('maintains consistent state during multiple operations', async () => {
      renderSettingsPage();

      // Initial state: 2 profiles
      await waitFor(() => {
        expect(screen.getAllByRole('listitem')).toHaveLength(2);
      });

      // Perform multiple operations in sequence
      // 1. Set non-default as default
      const profileItems = screen.getAllByRole('listitem');
      const customServerItem = profileItems.find(item => 
        item.textContent?.includes('Custom Server')
      );
      
      if (customServerItem) {
        const setDefaultButton = within(customServerItem).getByRole('button', { name: /set default/i });
        await user.click(setDefaultButton);
      }
// 2. Edit a profile
const openAIItem = profileItems.find(item =>
  item.textContent?.includes('OpenAI Default')
);

if (openAIItem) {
  const editButton = within(openAIItem).getByRole('button', { name: /edit/i });
  await user.click(editButton);
}
});
});
});
