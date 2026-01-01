/**
 * Tests for useLLMConnectionWizard hook
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useLLMConnectionWizard } from '@/shared/hooks/useLLMConnectionWizard';
import {
  useTestLLMConnection,
  useCreateLLMProfile,
  useUpdateLLMProfile,
} from '@/shared/hooks/llmProfilesHooks';
import { getAvailableModels } from '@/shared/utils/llmProfilesApi';

// Mock dependencies
jest.mock('@/shared/hooks/llmProfilesHooks');
jest.mock('@/shared/utils/llmProfilesApi');

const mockUseTestLLMConnection = useTestLLMConnection as jest.MockedFunction<typeof useTestLLMConnection>;
const mockUseCreateLLMProfile = useCreateLLMProfile as jest.MockedFunction<typeof useCreateLLMProfile>;
const mockUseUpdateLLMProfile = useUpdateLLMProfile as jest.MockedFunction<typeof useUpdateLLMProfile>;
const mockGetAvailableModels = getAvailableModels as jest.MockedFunction<typeof getAvailableModels>;

describe('useLLMConnectionWizard', () => {
  const mockTestConnection = jest.fn();
  const mockCreateProfile = jest.fn();
  const mockUpdateProfile = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseTestLLMConnection.mockReturnValue({
      testConnection: mockTestConnection,
      loading: false,
      error: null,
      testResult: null,
    });

    mockUseCreateLLMProfile.mockReturnValue({
      createProfile: mockCreateProfile,
      loading: false,
      createdProfile: null,
      error: null,
    });

    mockUseUpdateLLMProfile.mockReturnValue({
      updateProfile: mockUpdateProfile,
      loading: false,
      updatedProfile: null,
      error: null,
    });

    mockGetAvailableModels.mockResolvedValue({
      data: ['gpt-4', 'gpt-3.5-turbo'],
      models: ['gpt-4', 'gpt-3.5-turbo'],
    });
  });

  it('initializes with default state', () => {
    const { result } = renderHook(() => useLLMConnectionWizard());

    const [state] = result.current;

    expect(state.formData).toEqual({
      name: '',
      server_url: '',
      api_key: '',
      model: '',
      is_default: false,
    });
    expect(state.formErrors).toEqual({});
    expect(state.connectionTested).toBe(false);
    expect(state.connectionSuccess).toBeNull();
    expect(state.availableModels).toEqual([]);
    expect(state.loadingModels).toBe(false);
  });

  it('initializes with provided initialData', () => {
    const initialData = {
      id: 'profile-1',
      name: 'Existing Profile',
      server_url: 'https://api.example.com',
      api_key: 'secret-key',
      model: 'gpt-4',
      is_default: true,
    };

    const { result } = renderHook(() => useLLMConnectionWizard({ initialData }));

    const [state] = result.current;
    expect(state.formData).toEqual(initialData);
  });

  describe('handleChange', () => {
    it('updates form data for text input', () => {
      const { result } = renderHook(() => useLLMConnectionWizard());
      const [, actions] = result.current;

      act(() => {
        actions.handleChange({
          target: { name: 'name', value: 'New Profile', type: 'text' },
        } as React.ChangeEvent<HTMLInputElement>);
      });

      const [state] = result.current;
      expect(state.formData.name).toBe('New Profile');
    });

    it('updates form data for checkbox', () => {
      const { result } = renderHook(() => useLLMConnectionWizard());
      const [, actions] = result.current;

      act(() => {
        actions.handleChange({
          target: { name: 'is_default', checked: true, type: 'checkbox' },
        } as React.ChangeEvent<HTMLInputElement>);
      });

      const [state] = result.current;
      expect(state.formData.is_default).toBe(true);
    });

    it('clears error for changed field', () => {
      const { result } = renderHook(() => useLLMConnectionWizard());
      const [, actions] = result.current;

      // First set an error
      act(() => {
        actions.setFormData({ name: '' });
      });

      // Validate to trigger error
      act(() => {
        actions.validateForm();
      });

      let [state] = result.current;
      expect(state.formErrors.name).toBeDefined();

      // Change the field
      act(() => {
        actions.handleChange({
          target: { name: 'name', value: 'New Name', type: 'text' },
        } as React.ChangeEvent<HTMLInputElement>);
      });

      [state] = result.current;
      expect(state.formErrors.name).toBe('');
    });
  });

  describe('validateForm', () => {
    it('returns true for valid form', () => {
      const { result } = renderHook(() => useLLMConnectionWizard());
      const [, actions] = result.current;

      act(() => {
        actions.setFormData({
          name: 'Valid Profile',
          api_key: 'valid-api-key-1234567890',
          server_url: 'https://api.example.com',
        });
      });

      const isValid = actions.validateForm();
      expect(isValid).toBe(true);

      const [state] = result.current;
      expect(state.formErrors).toEqual({});
    });

    it('returns false and sets errors for invalid form', () => {
      const { result } = renderHook(() => useLLMConnectionWizard());
      const [, actions] = result.current;

      act(() => {
        actions.setFormData({
          name: '',
          api_key: 'short',
          server_url: 'invalid-url',
        });
      });

      const isValid = actions.validateForm();
      expect(isValid).toBe(false);

      const [state] = result.current;
      expect(state.formErrors.name).toBeDefined();
      expect(state.formErrors.api_key).toBeDefined();
      expect(state.formErrors.server_url).toBeDefined();
    });

    it('does not require API key for existing profile', () => {
      const initialData = { id: 'existing', name: 'Profile' };
      const { result } = renderHook(() => useLLMConnectionWizard({ initialData }));
      const [, actions] = result.current;

      act(() => {
        actions.setFormData({ name: 'Updated Name' });
      });

      const isValid = actions.validateForm();
      expect(isValid).toBe(true);
    });
  });

  describe('handleTestConnection', () => {
    it('tests connection successfully and loads models', async () => {
      mockTestConnection.mockResolvedValue({
        success: true,
        message: 'Connection successful',
      });

      const { result } = renderHook(() => useLLMConnectionWizard());
      const [, actions] = result.current;

      act(() => {
        actions.setFormData({
          api_key: 'valid-key',
          server_url: 'https://api.example.com',
        });
      });

      await act(async () => {
        await actions.handleTestConnection();
      });

      expect(mockTestConnection).toHaveBeenCalledWith(
        'https://api.example.com',
        'valid-key'
      );

      const [state] = result.current;
      expect(state.connectionTested).toBe(true);
      expect(state.connectionSuccess).toBe(true);
      expect(state.availableModels).toEqual(['gpt-4', 'gpt-3.5-turbo']);
    });

    it('shows error when API key is missing', async () => {
      const { result } = renderHook(() => useLLMConnectionWizard());
      const [, actions] = result.current;

      await act(async () => {
        await actions.handleTestConnection();
      });

      const [state] = result.current;
      expect(state.formErrors.api_key).toBe('API key is required to test connection.');
      expect(mockTestConnection).not.toHaveBeenCalled();
    });

    it('handles connection test failure', async () => {
      mockTestConnection.mockResolvedValue({
        success: false,
        message: 'Invalid API key',
      });

      const { result } = renderHook(() => useLLMConnectionWizard());
      const [, actions] = result.current;

      act(() => {
        actions.setFormData({ api_key: 'invalid-key' });
      });

      await act(async () => {
        await actions.handleTestConnection();
      });

      const [state] = result.current;
      expect(state.connectionTested).toBe(true);
      expect(state.connectionSuccess).toBe(false);
      expect(state.availableModels).toEqual([]);
    });

    it('handles connection test error', async () => {
      const error = new Error('Network error');
      mockTestConnection.mockRejectedValue(error);

      const onError = jest.fn();
      const { result } = renderHook(() => useLLMConnectionWizard({ onError }));
      const [, actions] = result.current;

      act(() => {
        actions.setFormData({ api_key: 'valid-key' });
      });

      await act(async () => {
        await actions.handleTestConnection();
      });

      expect(onError).toHaveBeenCalledWith(error);
      const [state] = result.current;
      expect(state.connectionTested).toBe(true);
      expect(state.availableModels).toEqual([]);
    });
  });

  describe('handleSubmit', () => {
    it('creates new profile successfully', async () => {
      mockCreateProfile.mockResolvedValue({ id: 'new-profile' });

      const onSuccess = jest.fn();
      const { result } = renderHook(() => useLLMConnectionWizard({ onSuccess }));
      const [, actions] = result.current;

      act(() => {
        actions.setFormData({
          name: 'New Profile',
          api_key: 'valid-key',
          server_url: 'https://api.example.com',
          model: 'gpt-4',
          is_default: false,
        });
      });

      await act(async () => {
        await actions.handleSubmit({ preventDefault: jest.fn() } as any);
      });

      expect(mockCreateProfile).toHaveBeenCalledWith({
        name: 'New Profile',
        server_url: 'https://api.example.com',
        api_key: 'valid-key',
        model: 'gpt-4',
        is_default: false,
      });
      expect(onSuccess).toHaveBeenCalled();
    });

    it('updates existing profile successfully', async () => {
      const initialData = { id: 'profile-1', name: 'Old Name' };
      mockUpdateProfile.mockResolvedValue({ id: 'profile-1' });

      const onSuccess = jest.fn();
      const { result } = renderHook(() =>
        useLLMConnectionWizard({ initialData, onSuccess })
      );
      const [, actions] = result.current;

      act(() => {
        actions.setFormData({ name: 'Updated Name' });
      });

      await act(async () => {
        await actions.handleSubmit({ preventDefault: jest.fn() } as any);
      });

      expect(mockUpdateProfile).toHaveBeenCalledWith('profile-1', {
        name: 'Updated Name',
        server_url: '',
        api_key: '',
        model: '',
        is_default: false,
      });
      expect(onSuccess).toHaveBeenCalled();
    });

    it('validates form before submitting', async () => {
      const { result } = renderHook(() => useLLMConnectionWizard());
      const [, actions] = result.current;

      // Empty form should fail validation
      await act(async () => {
        await actions.handleSubmit({ preventDefault: jest.fn() } as any);
      });

      expect(mockCreateProfile).not.toHaveBeenCalled();
      const [state] = result.current;
      expect(state.formErrors.name).toBeDefined();
    });

    it('handles submit error', async () => {
      const error = new Error('Save failed');
      mockCreateProfile.mockRejectedValue(error);

      const onError = jest.fn();
      const { result } = renderHook(() => useLLMConnectionWizard({ onError }));
      const [, actions] = result.current;

      act(() => {
        actions.setFormData({
          name: 'Profile',
          api_key: 'valid-key',
        });
      });

      await act(async () => {
        await actions.handleSubmit({ preventDefault: jest.fn() } as any);
      });

      expect(onError).toHaveBeenCalledWith(error);
      const [state] = result.current;
      expect(state.formErrors.submit).toBe('Failed to save profile. Please try again.');
    });
  });

  describe('loadModels', () => {
    it('loads models successfully', async () => {
      const { result } = renderHook(() => useLLMConnectionWizard());
      const [, actions] = result.current;

      act(() => {
        actions.setFormData({ api_key: 'valid-key' });
      });

      await act(async () => {
        await actions.loadModels();
      });

      expect(mockGetAvailableModels).toHaveBeenCalledWith('valid-key', '', undefined);
      const [state] = result.current;
      expect(state.availableModels).toEqual(['gpt-4', 'gpt-3.5-turbo']);
      expect(state.loadingModels).toBe(false);
    });

    it('handles missing API key', async () => {
      const { result } = renderHook(() => useLLMConnectionWizard());
      const [, actions] = result.current;

      await act(async () => {
        await actions.loadModels();
      });

      const [state] = result.current;
      expect(state.modelsError).toContain('API key is required');
      expect(state.availableModels).toEqual([]);
    });

    it('handles no models returned', async () => {
      mockGetAvailableModels.mockResolvedValue({});

      const { result } = renderHook(() => useLLMConnectionWizard());
      const [, actions] = result.current;

      act(() => {
        actions.setFormData({ api_key: 'valid-key' });
      });

      await act(async () => {
        await actions.loadModels();
      });

      const [state] = result.current;
      expect(state.modelsError).toContain('No models were returned');
      expect(state.availableModels).toEqual([]);
    });

    it('prevents duplicate loading', async () => {
      const { result } = renderHook(() => useLLMConnectionWizard());
      const [, actions] = result.current;

      act(() => {
        actions.setFormData({ api_key: 'valid-key' });
      });

      // Start first load
      let loadPromise: Promise<void>;
      await act(async () => {
        loadPromise = actions.loadModels();
      });

      // Try to load again while still loading
      await act(async () => {
        await actions.loadModels();
      });

      // Should only call getAvailableModels once
      expect(mockGetAvailableModels).toHaveBeenCalledTimes(1);

      // Wait for first load to complete
      await act(async () => {
        await loadPromise;
      });
    });
  });

  describe('resetForm', () => {
    it('resets form to initial state', () => {
      const initialData = { name: 'Initial' };
      const { result } = renderHook(() => useLLMConnectionWizard({ initialData }));
      const [, actions] = result.current;

      // Modify form
      act(() => {
        actions.setFormData({ name: 'Modified' });
        actions.setFormData({ api_key: 'key' });
      });

      act(() => {
        actions.resetForm();
      });

      const [state] = result.current;
      expect(state.formData.name).toBe('Initial');
      expect(state.formData.api_key).toBe('');
      expect(state.formErrors).toEqual({});
      expect(state.connectionTested).toBe(false);
      expect(state.availableModels).toEqual([]);
    });
  });

  describe('loading state', () => {
    it('returns loading true when testing connection', () => {
      mockUseTestLLMConnection.mockReturnValue({
        testConnection: mockTestConnection,
        loading: true,
        error: null,
        testResult: null,
      });

      const { result } = renderHook(() => useLLMConnectionWizard());
      const [, , loading] = result.current;

      expect(loading).toBe(true);
    });

    it('returns loading true when creating profile', () => {
      mockUseCreateLLMProfile.mockReturnValue({
        createProfile: mockCreateProfile,
        loading: true,
        createdProfile: null,
        error: null,
      });

      const { result } = renderHook(() => useLLMConnectionWizard());
      const [, , loading] = result.current;

      expect(loading).toBe(true);
    });
  });
});
