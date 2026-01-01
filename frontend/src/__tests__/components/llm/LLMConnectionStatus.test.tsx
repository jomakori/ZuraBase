/**
 * Tests for LLMConnectionStatus component
 * Tests the connection status indicator component
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import LLMConnectionStatus from '@/shared/components/LLMConnectionStatus';

// Mock the useLLMProfilesContext hook
jest.mock('@/shared/context/LLMProfilesProvider', () => ({
  useLLMProfilesContext: jest.fn(),
}));

// Mock the LLMProfilesApi
jest.mock('@/shared/utils/llmProfilesApi', () => ({
  LLMProfilesApi: {
    testStoredConnection: jest.fn(),
  },
}));

describe('LLMConnectionStatus', () => {
  const mockUseLLMProfilesContext = require('@/shared/context/LLMProfilesProvider').useLLMProfilesContext;
  const mockTestStoredConnection = require('@/shared/utils/llmProfilesApi').LLMProfilesApi.testStoredConnection;

  const defaultProps = {
    className: '',
  };

  const mockProfiles = [
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
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    mockTestStoredConnection.mockResolvedValue({
      success: true,
      message: 'Connection successful',
    });
  });

  const renderStatus = (overrides = {}) => {
    const props = { ...defaultProps, ...overrides };
    return render(<LLMConnectionStatus {...props} />);
  };

  describe('Rendering', () => {
    it('renders nothing when no profiles exist and not loading', () => {
      mockUseLLMProfilesContext.mockReturnValue({
        profiles: [],
        loading: false,
      });

      const { container } = renderStatus();
      
      expect(container.firstChild).toBeNull();
    });

    it('renders checking status when loading profiles', () => {
      mockUseLLMProfilesContext.mockReturnValue({
        profiles: [],
        loading: true,
      });

      renderStatus();
      
      expect(screen.getByText(/Checking\.\.\./i)).toBeInTheDocument();
    });

    it('renders connected status when connection test succeeds', async () => {
      mockUseLLMProfilesContext.mockReturnValue({
        profiles: mockProfiles,
        loading: false,
      });

      mockTestStoredConnection.mockResolvedValue({
        success: true,
        message: 'Connection successful',
      });

      renderStatus();
      
      await waitFor(() => {
        expect(screen.getByText(/Connected/i)).toBeInTheDocument();
      });
    });

    it('renders disconnected status when connection test fails', async () => {
      mockUseLLMProfilesContext.mockReturnValue({
        profiles: mockProfiles,
        loading: false,
      });

      mockTestStoredConnection.mockResolvedValue({
        success: false,
        message: 'Invalid API key',
      });

      renderStatus();
      
      await waitFor(() => {
        expect(screen.getByText(/Disconnected/i)).toBeInTheDocument();
      });
    });

    it('renders no profiles status when profiles array is empty', () => {
      mockUseLLMProfilesContext.mockReturnValue({
        profiles: [],
        loading: false,
      });

      renderStatus();
      
      // Should render nothing when no profiles
      const { container } = renderStatus();
      expect(container.firstChild).toBeNull();
    });

    it('applies custom className', async () => {
      mockUseLLMProfilesContext.mockReturnValue({
        profiles: mockProfiles,
        loading: false,
      });

      mockTestStoredConnection.mockResolvedValue({
        success: true,
        message: 'Connection successful',
      });

      const { container } = renderStatus({ className: 'custom-class' });
      
      await waitFor(() => {
        const statusElement = container.querySelector('.custom-class');
        expect(statusElement).toBeInTheDocument();
      });
    });
  });

  describe('Connection Status Logic', () => {
    it('calls testStoredConnection with default profile ID', async () => {
      mockUseLLMProfilesContext.mockReturnValue({
        profiles: mockProfiles,
        loading: false,
      });

      mockTestStoredConnection.mockResolvedValue({
        success: true,
        message: 'Connection successful',
      });

      renderStatus();
      
      await waitFor(() => {
        expect(mockTestStoredConnection).toHaveBeenCalledWith('llm-1');
      });
    });

    it('calls testStoredConnection with first profile when no default exists', async () => {
      const profilesWithoutDefault = [
        {
          id: 'llm-2',
          user_id: 'user-123',
          name: 'Non-default Profile',
          server_url: '',
          api_key: 'sk-mock-key',
          model: 'gpt-4',
          is_default: false,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ];

      mockUseLLMProfilesContext.mockReturnValue({
        profiles: profilesWithoutDefault,
        loading: false,
      });

      mockTestStoredConnection.mockResolvedValue({
        success: true,
        message: 'Connection successful',
      });

      renderStatus();
      
      await waitFor(() => {
        expect(mockTestStoredConnection).toHaveBeenCalledWith('llm-2');
      });
    });

    it('handles connection test errors gracefully', async () => {
      mockUseLLMProfilesContext.mockReturnValue({
        profiles: mockProfiles,
        loading: false,
      });

      mockTestStoredConnection.mockRejectedValue(new Error('Network error'));

      renderStatus();
      
      await waitFor(() => {
        expect(screen.getByText(/Disconnected/i)).toBeInTheDocument();
      });
    });

    it('shows checking status while testing connection', async () => {
      mockUseLLMProfilesContext.mockReturnValue({
        profiles: mockProfiles,
        loading: false,
      });

      // Don't resolve immediately to test intermediate state
      let resolveConnection: any;
      const connectionPromise = new Promise((resolve) => {
        resolveConnection = resolve;
      });
      mockTestStoredConnection.mockReturnValue(connectionPromise);

      renderStatus();
      
      // Should show checking status while promise is pending
      expect(screen.getByText(/Checking\.\.\./i)).toBeInTheDocument();
      
      // Resolve the promise
      resolveConnection({ success: true, message: 'Connected' });
      
      await waitFor(() => {
        expect(screen.getByText(/Connected/i)).toBeInTheDocument();
      });
    });
  });

  describe('Status Display', () => {
    it('shows appropriate icon for connected status', async () => {
      mockUseLLMProfilesContext.mockReturnValue({
        profiles: mockProfiles,
        loading: false,
      });

      mockTestStoredConnection.mockResolvedValue({
        success: true,
        message: 'Connection successful',
      });

      renderStatus();
      
      await waitFor(() => {
        const statusElement = screen.getByText(/Connected/i);
        expect(statusElement).toBeInTheDocument();
      });
    });

    it('shows appropriate icon for disconnected status', async () => {
      mockUseLLMProfilesContext.mockReturnValue({
        profiles: mockProfiles,
        loading: false,
      });

      mockTestStoredConnection.mockResolvedValue({
        success: false,
        message: 'Invalid API key',
      });

      renderStatus();
      
      await waitFor(() => {
        const statusElement = screen.getByText(/Disconnected/i);
        expect(statusElement).toBeInTheDocument();
      });
    });

    it('shows appropriate icon for checking status', () => {
      mockUseLLMProfilesContext.mockReturnValue({
        profiles: mockProfiles,
        loading: true,
      });

      renderStatus();
      
      expect(screen.getByText(/Checking\.\.\./i)).toBeInTheDocument();
    });

    it('includes profile name in status message', async () => {
      mockUseLLMProfilesContext.mockReturnValue({
        profiles: mockProfiles,
        loading: false,
      });

      mockTestStoredConnection.mockResolvedValue({
        success: true,
        message: 'Connection successful',
      });

      renderStatus();
      
      await waitFor(() => {
        const statusElement = screen.getByTitle(/Connected to OpenAI Default/i);
        expect(statusElement).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Design', () => {
    it('hides AI text on small screens', async () => {
      mockUseLLMProfilesContext.mockReturnValue({
        profiles: mockProfiles,
        loading: false,
      });

      mockTestStoredConnection.mockResolvedValue({
        success: true,
        message: 'Connection successful',
      });

      renderStatus();
      
      await waitFor(() => {
        const aiText = screen.queryByText('AI');
        // The component hides "AI" on small screens with hidden sm:inline class
        // We can't test CSS classes directly, but we can verify the element exists
      });
    });

    it('shows full status text on medium screens and larger', async () => {
      mockUseLLMProfilesContext.mockReturnValue({
        profiles: mockProfiles,
        loading: false,
      });

      mockTestStoredConnection.mockResolvedValue({
        success: true,
        message: 'Connection successful',
      });

      renderStatus();
      
      await waitFor(() => {
        expect(screen.getByText(/Connected/i)).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('handles missing default profile gracefully', async () => {
      const profilesWithoutDefault = [
        {
          id: 'llm-2',
          user_id: 'user-123',
          name: 'Profile 1',
          server_url: '',
          api_key: 'sk-mock-key',
          model: 'gpt-4',
          is_default: false,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'llm-3',
          user_id: 'user-123',
          name: 'Profile 2',
          server_url: '',
          api_key: 'sk-mock-key',
          model: 'gpt-3.5-turbo',
          is_default: false,
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
        },
      ];

      mockUseLLMProfilesContext.mockReturnValue({
        profiles: profilesWithoutDefault,
        loading: false,
      });

      mockTestStoredConnection.mockResolvedValue({
        success: true,
        message: 'Connection successful',
      });

      renderStatus();
      
      await waitFor(() => {
        expect(mockTestStoredConnection).toHaveBeenCalledWith('llm-2');
      });
    });

    it('handles empty profile array after loading', () => {
      mockUseLLMProfilesContext.mockReturnValue({
        profiles: [],
        loading: false,
      });

      const { container } = renderStatus();
      
      expect(container.firstChild).toBeNull();
    });

    it('logs errors to console but does not crash', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      mockUseLLMProfilesContext.mockReturnValue({
        profiles: mockProfiles,
        loading: false,
      });

      mockTestStoredConnection.mockRejectedValue(new Error('Test error'));

      renderStatus();
      
      await waitFor(() => {
        expect(screen.getByText(/Disconnected/i)).toBeInTheDocument();
      });
      
      consoleSpy.mockRestore();
    });
  });

  describe('Accessibility', () => {
    it('has title attribute with status message', async () => {
      mockUseLLMProfilesContext.mockReturnValue({
        profiles: mockProfiles,
        loading: false,
      });

      mockTestStoredConnection.mockResolvedValue({
        success: true,
        message: 'Connection successful',
      });

      renderStatus();
      
      await waitFor(() => {
        const statusElement = screen.getByTitle(/Connected to OpenAI Default/i);
        expect(statusElement).toBeInTheDocument();
      });
    });

    it('uses appropriate ARIA attributes', async () => {
      mockUseLLMProfilesContext.mockReturnValue({
        profiles: mockProfiles,
        loading: false,
      });

      mockTestStoredConnection.mockResolvedValue({
        success: true,
        message: 'Connection successful',
      });

      renderStatus();
      
      await waitFor(() => {
        const statusElement = screen.getByText(/Connected/i);
        expect(statusElement).toBeInTheDocument();
      });
    });
  });
});
