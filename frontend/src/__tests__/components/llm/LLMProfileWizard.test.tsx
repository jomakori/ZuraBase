/**
 * Tests for LLMProfileWizard component
 * Tests the wizard for creating and editing LLM profiles
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import LLMProfileWizard from '@/shared/components/LLMProfileWizard';

// Mock the useLLMConnectionWizard hook
jest.mock('@/shared/hooks/useLLMConnectionWizard', () => ({
  useLLMConnectionWizard: jest.fn(),
}));

// Mock the SearchableModelSelect component
jest.mock('@/shared/components/SearchableModelSelect', () => {
  const MockSearchableModelSelect = ({ value, onChange, options, disabled, loading, placeholder }: any) => (
    <div data-testid="searchable-model-select">
      <select 
        value={value} 
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        data-testid="model-select"
      >
        <option value="">{placeholder}</option>
        {options.map((opt: string) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
      {loading && <span data-testid="model-select-loading">Loading...</span>}
    </div>
  );
  return { SearchableModelSelect: MockSearchableModelSelect };
});

describe('LLMProfileWizard', () => {
  const mockOnComplete = jest.fn();
  const mockOnSkip = jest.fn();
  
  const defaultProps = {
    onComplete: mockOnComplete,
    onSkip: mockOnSkip,
    initialData: undefined,
    showSkipButton: false,
    autoDefaultFirst: false,
  };

  const mockUseLLMConnectionWizard = require('@/shared/hooks/useLLMConnectionWizard').useLLMConnectionWizard;

  const mockState = {
    formData: {
      name: '',
      server_url: '',
      api_key: '',
      model: '',
      is_default: false,
      service: 'openai',
    },
    formErrors: {},
    connectionTested: false,
    connectionSuccess: null,
    connectionMessage: null,
    availableModels: [],
    loadingModels: false,
    modelsError: null,
  };

  const mockActions = {
    handleChange: jest.fn(),
    handleTestConnection: jest.fn(),
    handleSubmit: jest.fn((e) => {
      e.preventDefault();
      return Promise.resolve();
    }),
    setFormData: jest.fn(),
    loadModels: jest.fn(),
  };

  const mockLoading = false;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseLLMConnectionWizard.mockReturnValue([mockState, mockActions, mockLoading]);
  });

  const renderWizard = (overrides = {}) => {
    const props = { ...defaultProps, ...overrides };
    return render(<LLMProfileWizard {...props} />);
  };

  describe('Rendering', () => {
    it('renders wizard with title for new profile', () => {
      renderWizard();
      
      expect(screen.getByText('Set Up Your LLM Profile')).toBeInTheDocument();
      expect(screen.getByText('Configure your preferred AI service.')).toBeInTheDocument();
    });

    it('renders wizard with title for editing profile', () => {
      mockUseLLMConnectionWizard.mockReturnValue([{
        ...mockState,
        formData: { ...mockState.formData, id: 'profile-123', name: 'Existing Profile' },
      }, mockActions, mockLoading]);
      
      renderWizard({ initialData: { id: 'profile-123' } });
      
      expect(screen.getByText('Edit LLM Profile')).toBeInTheDocument();
    });

    it('renders all form fields', () => {
      renderWizard();
      
      expect(screen.getByLabelText(/Profile Name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/LLM Service/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/API Key/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Test Connection/i })).toBeInTheDocument();
    });

    it('renders service dropdown with options', () => {
      renderWizard();
      
      const serviceSelect = screen.getByLabelText(/LLM Service/i);
      expect(serviceSelect).toBeInTheDocument();
      expect(serviceSelect).toHaveValue('openai');
    });

    it('does not show custom server URL field for non-custom service', () => {
      renderWizard();
      
      expect(screen.queryByLabelText(/Custom Server URL/i)).not.toBeInTheDocument();
    });

    it('shows custom server URL field for custom service', () => {
      mockUseLLMConnectionWizard.mockReturnValue([{
        ...mockState,
        formData: { ...mockState.formData, service: 'custom' },
      }, mockActions, mockLoading]);
      
      renderWizard();
      
      expect(screen.getByLabelText(/Custom Server URL/i)).toBeInTheDocument();
    });

    it('renders skip button when showSkipButton is true', () => {
      renderWizard({ showSkipButton: true });
      
      expect(screen.getByRole('button', { name: /Skip Setup/i })).toBeInTheDocument();
    });

    it('does not render skip button when showSkipButton is false', () => {
      renderWizard({ showSkipButton: false });
      
      expect(screen.queryByRole('button', { name: /Skip Setup/i })).not.toBeInTheDocument();
    });

    it('renders close button', () => {
      renderWizard();
      
      expect(screen.getByLabelText(/Close wizard/i)).toBeInTheDocument();
    });

    it('renders model selection only after successful connection test', () => {
      renderWizard();
      
      expect(screen.queryByTestId('searchable-model-select')).not.toBeInTheDocument();
    });

    it('renders model selection when connection is successful', () => {
      mockUseLLMConnectionWizard.mockReturnValue([{
        ...mockState,
        connectionTested: true,
        connectionSuccess: true,
        availableModels: ['gpt-4', 'gpt-3.5-turbo'],
      }, mockActions, mockLoading]);
      
      renderWizard();
      
      expect(screen.getByTestId('searchable-model-select')).toBeInTheDocument();
    });

    it('renders set as default checkbox for new profiles', () => {
      renderWizard();
      
      expect(screen.getByLabelText(/Set as default LLM profile/i)).toBeInTheDocument();
    });

    it('does not render set as default checkbox for editing profiles', () => {
      mockUseLLMConnectionWizard.mockReturnValue([{
        ...mockState,
        formData: { ...mockState.formData, id: 'profile-123' },
      }, mockActions, mockLoading]);
      
      renderWizard({ initialData: { id: 'profile-123' } });
      
      expect(screen.queryByLabelText(/Set as default LLM profile/i)).not.toBeInTheDocument();
    });
  });

  describe('Form Interactions', () => {
    it('calls handleChange when profile name is changed', () => {
      renderWizard();
      
      const nameInput = screen.getByLabelText(/Profile Name/i);
      fireEvent.change(nameInput, { target: { name: 'name', value: 'New Profile' } });
      
      expect(mockActions.handleChange).toHaveBeenCalled();
    });

    it('calls handleChange when service is changed', () => {
      renderWizard();
      
      const serviceSelect = screen.getByLabelText(/LLM Service/i);
      fireEvent.change(serviceSelect, { target: { name: 'service', value: 'anthropic' } });
      
      expect(mockActions.handleChange).toHaveBeenCalled();
    });

    it('calls handleChange when API key is changed', () => {
      renderWizard();
      
      const apiKeyInput = screen.getByLabelText(/API Key/i);
      fireEvent.change(apiKeyInput, { target: { name: 'api_key', value: 'sk-test-key' } });
      
      expect(mockActions.handleChange).toHaveBeenCalled();
    });

    it('calls handleTestConnection when test button is clicked', () => {
      mockUseLLMConnectionWizard.mockReturnValue([{
        ...mockState,
        formData: { ...mockState.formData, api_key: 'sk-test-key' },
      }, mockActions, mockLoading]);
      
      renderWizard();
      
      const testButton = screen.getByRole('button', { name: /Test Connection/i });
      fireEvent.click(testButton);
      
      expect(mockActions.handleTestConnection).toHaveBeenCalled();
    });

    it('disables test button when API key is empty', () => {
      renderWizard();
      
      const testButton = screen.getByRole('button', { name: /Test Connection/i });
      expect(testButton).toBeDisabled();
    });

    it('enables test button when API key is provided', () => {
      mockUseLLMConnectionWizard.mockReturnValue([{
        ...mockState,
        formData: { ...mockState.formData, api_key: 'sk-test-key' },
      }, mockActions, mockLoading]);
      
      renderWizard();
      
      const testButton = screen.getByRole('button', { name: /Test Connection/i });
      expect(testButton).not.toBeDisabled();
    });

    it('calls handleSubmit when form is submitted', () => {
      mockUseLLMConnectionWizard.mockReturnValue([{
        ...mockState,
        formData: { ...mockState.formData, api_key: 'sk-test-key', model: 'gpt-4' },
        connectionTested: true,
        connectionSuccess: true,
      }, mockActions, mockLoading]);
      
      renderWizard();
      
      const form = screen.getByRole('form');
      fireEvent.submit(form);
      
      expect(mockActions.handleSubmit).toHaveBeenCalled();
    });

    it('disables submit button when loading', () => {
      mockUseLLMConnectionWizard.mockReturnValue([mockState, mockActions, true]);
      
      renderWizard();
      
      const submitButton = screen.getByRole('button', { name: /Save Profile/i });
      expect(submitButton).toBeDisabled();
    });

    it('disables submit button when no model selected for new profile', () => {
      mockUseLLMConnectionWizard.mockReturnValue([{
        ...mockState,
        formData: { ...mockState.formData, api_key: 'sk-test-key' },
        connectionTested: true,
        connectionSuccess: true,
      }, mockActions, mockLoading]);
      
      renderWizard();
      
      const submitButton = screen.getByRole('button', { name: /Save Profile/i });
      expect(submitButton).toBeDisabled();
    });

    it('enables submit button when model is selected for new profile', () => {
      mockUseLLMConnectionWizard.mockReturnValue([{
        ...mockState,
        formData: { ...mockState.formData, api_key: 'sk-test-key', model: 'gpt-4' },
        connectionTested: true,
        connectionSuccess: true,
      }, mockActions, mockLoading]);
      
      renderWizard();
      
      const submitButton = screen.getByRole('button', { name: /Save Profile/i });
      expect(submitButton).not.toBeDisabled();
    });

    it('enables submit button for editing profile without connection test', () => {
      mockUseLLMConnectionWizard.mockReturnValue([{
        ...mockState,
        formData: { ...mockState.formData, id: 'profile-123', api_key: 'sk-test-key', model: 'gpt-4' },
      }, mockActions, mockLoading]);
      
      renderWizard({ initialData: { id: 'profile-123' } });
      
      const submitButton = screen.getByRole('button', { name: /Save Changes/i });
      expect(submitButton).not.toBeDisabled();
    });
  });

  describe('Connection Test Results', () => {
    it('shows success message when connection test succeeds', () => {
      mockUseLLMConnectionWizard.mockReturnValue([{
        ...mockState,
        connectionTested: true,
        connectionSuccess: true,
        connectionMessage: 'Connection successful',
      }, mockActions, mockLoading]);
      
      renderWizard();
      
      expect(screen.getByText('Connection successful')).toBeInTheDocument();
    });

    it('shows error message when connection test fails', () => {
      mockUseLLMConnectionWizard.mockReturnValue([{
        ...mockState,
        connectionTested: true,
        connectionSuccess: false,
        connectionMessage: 'Invalid API key',
      }, mockActions, mockLoading]);
      
      renderWizard();
      
      expect(screen.getByText('Invalid API key')).toBeInTheDocument();
    });

    it('shows loading indicator during connection test', () => {
      mockUseLLMConnectionWizard.mockReturnValue([mockState, mockActions, true]);
      
      renderWizard();
      
      expect(screen.getByRole('button', { name: /Test Connection/i })).toBeDisabled();
    });
  });

  describe('Model Selection', () => {
    it('shows loading indicator when loading models', () => {
      mockUseLLMConnectionWizard.mockReturnValue([{
        ...mockState,
        connectionTested: true,
        connectionSuccess: true,
        loadingModels: true,
      }, mockActions, mockLoading]);
      
      renderWizard();
      
      expect(screen.getByTestId('model-select-loading')).toBeInTheDocument();
    });

    it('shows error message when model loading fails', () => {
      mockUseLLMConnectionWizard.mockReturnValue([{
        ...mockState,
        connectionTested: true,
        connectionSuccess: true,
        modelsError: 'Failed to load models',
      }, mockActions, mockLoading]);
      
      renderWizard();
      
      expect(screen.getByText('Failed to load models')).toBeInTheDocument();
    });

    it('shows available models in dropdown', () => {
      mockUseLLMConnectionWizard.mockReturnValue([{
        ...mockState,
        connectionTested: true,
        connectionSuccess: true,
        availableModels: ['gpt-4', 'gpt-3.5-turbo', 'claude-3'],
      }, mockActions, mockLoading]);
      
      renderWizard();
      
      const modelSelect = screen.getByTestId('model-select');
      expect(modelSelect).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    it('shows error message for invalid profile name', () => {
      mockUseLLMConnectionWizard.mockReturnValue([{
        ...mockState,
        formErrors: { name: 'Profile name is required' },
      }, mockActions, mockLoading]);
      
      renderWizard();
      
      expect(screen.getByText('Profile name is required')).toBeInTheDocument();
    });

    it('shows error message for invalid API key', () => {
      mockUseLLMConnectionWizard.mockReturnValue([{
        ...mockState,
        formErrors: { api_key: 'API key is required' },
      }, mockActions, mockLoading]);
      
      renderWizard();
      
      expect(screen.getByText('API key is required')).toBeInTheDocument();
    });

    it('shows error message for invalid server URL', () => {
      mockUseLLMConnectionWizard.mockReturnValue([{
        ...mockState,
        formData: { ...mockState.formData, service: 'custom' },
        formErrors: { server_url: 'Invalid URL format' },
      }, mockActions, mockLoading]);
      
      renderWizard();
      
      expect(screen.getByText('Invalid URL format')).toBeInTheDocument();
    });

    it('shows submit error message', () => {
      mockUseLLMConnectionWizard.mockReturnValue([{
        ...mockState,
        formErrors: { submit: 'Failed to save profile' },
      }, mockActions, mockLoading]);
      
      renderWizard();
      
      expect(screen.getByText('Failed to save profile')).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('calls onSkip when skip button is clicked', () => {
      renderWizard({ showSkipButton: true });
      
      const skipButton = screen.getByRole('button', { name: /Skip Setup/i });
      fireEvent.click(skipButton);
      
      expect(mockOnSkip).toHaveBeenCalled();
    });

    it('calls onSkip when close button is clicked', () => {
      renderWizard();
      
      const closeButton = screen.getByLabelText(/Close wizard/i);
      fireEvent.click(closeButton);
      
      expect(mockOnSkip).toHaveBeenCalled();
    });

    it('calls onComplete when form submission succeeds', async () => {
      mockActions.handleSubmit.mockImplementation((e) => {
        e.preventDefault();
        mockOnComplete();
        return Promise.resolve();
      });
      
      mockUseLLMConnectionWizard.mockReturnValue([{
        ...mockState,
        formData: { ...mockState.formData, api_key: 'sk-test-key', model: 'gpt-4' },
        connectionTested: true,
        connectionSuccess: true,
      }, mockActions, mockLoading]);
      
      renderWizard();
      
      const form = screen.getByRole('form');
      fireEvent.submit(form);
      
      await waitFor(() => {
        expect(mockOnComplete).toHaveBeenCalled();
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper form labels', () => {
      renderWizard();
      
      expect(screen.getByLabelText(/Profile Name/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/LLM Service/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/API Key/i)).toBeInTheDocument();
    });
it('has proper button labels', () => {
  renderWizard();
  
  expect(screen.getByRole('button', { name: /Test Connection/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Save Profile/i })).toBeInTheDocument();
});
});
});

