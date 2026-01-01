/**
 * Tests for LLM Profiles API client
 */

import { LLMProfilesApi, getAvailableModels, fetchModelsFromLangChain } from '@/shared/utils/llmProfilesApi';
import { setupMockHandlers, cleanupMockHandlers } from '@/shared/fixtures/mockHandlers';
import { mockLLMProfiles } from '@/shared/fixtures/mockData';

// Mock the auth refresh module
jest.mock('@/shared/utils/authRefresh', () => ({
  handleAuthError: jest.fn().mockResolvedValue(false),
}));

// Mock the client logger
jest.mock('@/shared/utils/clientLogger', () => ({
  log: {
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('LLMProfilesApi', () => {
  beforeEach(() => {
    setupMockHandlers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanupMockHandlers();
  });

  describe('getProfiles', () => {
    it('fetches profiles successfully', async () => {
      const result = await LLMProfilesApi.getProfiles();
      expect(result).toEqual({ profiles: mockLLMProfiles });
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/llm-profiles'),
        expect.objectContaining({
          method: 'GET',
          credentials: 'include',
        })
      );
    });

    it('handles authentication errors', async () => {
      // Mock fetch to return 401
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized'),
      });

      const { handleAuthError } = require('@/shared/utils/authRefresh');
      handleAuthError.mockResolvedValue(true);

      await expect(LLMProfilesApi.getProfiles()).rejects.toThrow(
        'Authentication required - please log in again'
      );
    });

    it('handles network errors', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));
      await expect(LLMProfilesApi.getProfiles()).rejects.toThrow('Network error');
    });
  });

  describe('getProfile', () => {
    it('fetches a single profile successfully', async () => {
      const profileId = 'llm-1';
      const result = await LLMProfilesApi.getProfile(profileId);
      expect(result).toEqual({ profile: mockLLMProfiles[0] });
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/api/llm-profiles/${profileId}`),
        expect.objectContaining({ method: 'GET' })
      );
    });

    it('throws error when profile not found', async () => {
      // Mock fetch to return 404
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Not found'),
      });

      await expect(LLMProfilesApi.getProfile('nonexistent')).rejects.toThrow(
        'Failed to fetch LLM profile'
      );
    });
  });

  describe('createProfile', () => {
    it('creates a new profile successfully', async () => {
      const newProfile = {
        name: 'New Profile',
        server_url: 'https://api.new.com',
        api_key: 'new-key',
        model: 'gpt-4',
        is_default: false,
      };

      const result = await LLMProfilesApi.createProfile(newProfile);
      expect(result).toHaveProperty('profile');
      expect(result.profile).toMatchObject({
        name: newProfile.name,
        server_url: newProfile.server_url,
        is_default: newProfile.is_default,
      });
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/llm-profiles'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(newProfile),
        })
      );
    });
  });

  describe('updateProfile', () => {
    it('updates an existing profile successfully', async () => {
      const profileId = 'llm-1';
      const updates = {
        name: 'Updated Name',
        server_url: 'https://api.updated.com',
      };

      const result = await LLMProfilesApi.updateProfile(profileId, updates);
      expect(result).toHaveProperty('profile');
      expect(result.profile).toMatchObject(updates);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/api/llm-profiles/${profileId}`),
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify(updates),
        })
      );
    });
  });

  describe('deleteProfile', () => {
    it('deletes a profile successfully', async () => {
      const profileId = 'llm-1';
      await LLMProfilesApi.deleteProfile(profileId);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/api/llm-profiles/${profileId}`),
        expect.objectContaining({ method: 'DELETE' })
      );
    });
  });

  describe('setDefaultProfile', () => {
    it('sets a profile as default successfully', async () => {
      const profileId = 'llm-2';
      const result = await LLMProfilesApi.setDefaultProfile(profileId);
      expect(result).toHaveProperty('profile');
      expect(result.profile?.is_default).toBe(true);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/api/llm-profiles/${profileId}/set-default`),
        expect.objectContaining({ method: 'PUT' })
      );
    });
  });

  describe('testConnection', () => {
    it('tests connection successfully', async () => {
      const testRequest = {
        server_url: 'https://api.test.com',
        api_key: 'test-key',
      };

      const result = await LLMProfilesApi.testConnection(testRequest);
      expect(result).toEqual({
        success: true,
        message: 'Connection successful',
      });
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/llm-profiles/test-connection'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(testRequest),
        })
      );
    });
  });

  describe('testStoredConnection', () => {
    it('tests stored connection successfully', async () => {
      const profileId = 'llm-1';
      const result = await LLMProfilesApi.testStoredConnection(profileId);
      expect(result).toEqual({
        success: true,
        message: 'Connection successful',
      });
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(`/api/llm-profiles/${profileId}/test-stored-connection`),
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('throws error when profile ID is empty', async () => {
      await expect(LLMProfilesApi.testStoredConnection('')).rejects.toThrow(
        'Profile ID is required for connection test'
      );
    });
  });
});

describe('getAvailableModels', () => {
  beforeEach(() => {
    setupMockHandlers();
  });

  afterEach(() => {
    cleanupMockHandlers();
  });

  it('fetches models successfully', async () => {
    const mockModels = { models: ['gpt-4', 'gpt-3.5-turbo'] };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockModels),
    });

    const result = await getAvailableModels();
    expect(result).toEqual(mockModels);
  });

  it('handles fetch errors', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve('Internal server error'),
    });

    await expect(getAvailableModels()).rejects.toThrow('Failed to fetch models');
  });
});

describe('fetchModelsFromLangChain', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches models from LangChain successfully', async () => {
    const mockResponse = {
      models: ['model1', 'model2'],
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await fetchModelsFromLangChain('openai', 'api-key');
    expect(result).toEqual({
      data: mockResponse.models,
      models: mockResponse.models,
    });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/langchain/models'),
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer api-key',
        }),
      })
    );
  });

  it('uses custom server URL when provided', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ models: [] }),
    });

    await fetchModelsFromLangChain('openai', 'api-key', 'https://custom.server.com');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('https://custom.server.com/api/v1/langchain/models'),
      expect.any(Object)
    );
  });

  it('throws error when response has no models', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}),
    });

    await expect(fetchModelsFromLangChain('openai', 'api-key')).rejects.toThrow(
      'Response from LangChain did not contain models or data.'
    );
  });
});
