/**
 * Tests for StrandsApp component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StrandsApp from '@/features/strands/components/StrandsApp';
import { renderWithProviders, setupTest } from '@/shared/fixtures/testUtils';
import { mockStrands } from '@/shared/fixtures/mockData';

// Mock hooks and components
jest.mock('@/features/auth/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/shared/context/LLMProfilesProvider', () => ({
  useLLMProfilesContext: jest.fn(),
}));

jest.mock('@/features/strands/hooks/strands.hooks', () => ({
  useCreateStrand: jest.fn(),
}));

jest.mock('@/features/strands/services/syncService', () => ({
  syncService: {
    syncMultiple: jest.fn(),
    cancel: jest.fn(),
  },
}));

// Mock child components to simplify testing
jest.mock('@/features/strands/components/StrandsList', () => ({
  __esModule: true,
  default: ({ onStrandSelect, onCreateStrand }: any) => (
    <div data-testid="strands-list">
      <button onClick={() => onStrandSelect?.(mockStrands[0])}>Select Strand</button>
      <button onClick={onCreateStrand}>Create Strand</button>
    </div>
  ),
}));

jest.mock('@/features/strands/components/StrandDetail', () => ({
  __esModule: true,
  default: ({ strandId, onBack }: any) => (
    <div data-testid="strand-detail">
      <div>Strand Detail for {strandId}</div>
      <button onClick={onBack}>Back</button>
    </div>
  ),
}));

jest.mock('@/features/strands/components/ImportIntegrationsSection', () => ({
  __esModule: true,
  default: ({ isLinked, whatsappName, onLogin }: any) => (
    <div data-testid="import-integrations">
      <button onClick={onLogin}>Login WhatsApp</button>
    </div>
  ),
}));

jest.mock('@/shared/components/LLMProfileWizard', () => ({
  __esModule: true,
  default: ({ onComplete, onSkip }: any) => (
    <div data-testid="llm-wizard">
      <button onClick={onComplete}>Complete</button>
      <button onClick={onSkip}>Skip</button>
    </div>
  ),
}));

jest.mock('@/shared/components/Dialog', () => ({
  __esModule: true,
  default: ({ isOpen, title, message, onConfirm, onCancel }: any) =>
    isOpen ? (
      <div data-testid="dialog">
        <h3>{title}</h3>
        <p>{message}</p>
        <button onClick={onConfirm}>Confirm</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    ) : null,
}));

jest.mock('@/shared/components/Toast', () => ({
  __esModule: true,
  default: ({ isOpen, message, onClose }: any) =>
    isOpen ? (
      <div data-testid="toast">
        <span>{message}</span>
        <button onClick={onClose}>Close</button>
      </div>
    ) : null,
}));

jest.mock('@/features/strands/components/SyncProgressModal', () => ({
  __esModule: true,
  default: ({ isOpen, progress, onClose, onCancel }: any) =>
    isOpen ? (
      <div data-testid="sync-progress-modal">
        <div>Progress: {progress.status}</div>
        <button onClick={onClose}>Close</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    ) : null,
}));

describe('StrandsApp', () => {
  const { user } = setupTest();
  const mockUseAuth = require('@/features/auth/context/AuthContext').useAuth;
  const mockUseLLMProfilesContext = require('@/shared/context/LLMProfilesProvider').useLLMProfilesContext;
  const mockUseCreateStrand = require('@/features/strands/hooks/strands.hooks').useCreateStrand;
  const mockSyncService = require('@/features/strands/services/syncService').syncService;

  const defaultAuth = {
    user: { id: 'user-1', name: 'Test User', email: 'test@example.com' },
    login: jest.fn(),
    logout: jest.fn(),
    isLoading: false,
  };

  const defaultLLMProfiles = {
    profiles: [{ id: 'profile-1', name: 'Default', is_default: true }],
    loading: false,
    error: null,
    refreshProfiles: jest.fn(),
    setDefaultProfile: jest.fn(),
  };

  const defaultCreateStrand = {
    createStrand: jest.fn().mockResolvedValue({ strand: mockStrands[0] }),
    loading: false,
    error: null,
  };

  beforeEach(() => {
    mockUseAuth.mockReturnValue(defaultAuth);
    mockUseLLMProfilesContext.mockReturnValue(defaultLLMProfiles);
    mockUseCreateStrand.mockReturnValue(defaultCreateStrand);
    mockSyncService.syncMultiple.mockClear();
    mockSyncService.cancel.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders authentication required page when user is not authenticated', () => {
      mockUseAuth.mockReturnValue({ user: null, isLoading: false });
      renderWithProviders(<StrandsApp />);

      expect(screen.getByText('Authentication Required')).toBeInTheDocument();
      expect(screen.getByText('Please sign in to access your Strands.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Go to Login/i })).toBeInTheDocument();
    });

    it('renders main app when user is authenticated', () => {
      renderWithProviders(<StrandsApp />);

      expect(screen.getByText('Strands Library')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Search strands...')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Sync All/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /\+ New Strand/i })).toBeInTheDocument();
      expect(screen.getByTestId('strands-list')).toBeInTheDocument();
    });

    it('shows LLM wizard when no profiles exist and user has not seen it', async () => {
      mockUseLLMProfilesContext.mockReturnValue({
        profiles: [],
        loading: false,
      });
      renderWithProviders(<StrandsApp />);

      await waitFor(() => {
        expect(screen.getByTestId('llm-wizard')).toBeInTheDocument();
      });
    });

    it('does not show LLM wizard when profiles exist', () => {
      renderWithProviders(<StrandsApp />);
      expect(screen.queryByTestId('llm-wizard')).not.toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('switches to create form when New Strand button is clicked', async () => {
      renderWithProviders(<StrandsApp />);

      const newStrandButton = screen.getByRole('button', { name: /\+ New Strand/i });
      await user.click(newStrandButton);

      expect(screen.getByText('Create New Strand')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Enter a thought, insight, or pasted content...')).toBeInTheDocument();
    });

    it('switches to detail view when a strand is selected', async () => {
      renderWithProviders(<StrandsApp />);

      const selectButton = screen.getByRole('button', { name: /Select Strand/i });
      await user.click(selectButton);

      expect(screen.getByTestId('strand-detail')).toBeInTheDocument();
      expect(screen.getByText(/Strand Detail for strand-/)).toBeInTheDocument();
    });

    it('returns to list view from detail view when back is clicked', async () => {
      renderWithProviders(<StrandsApp />);

      // First select a strand to go to detail view
      const selectButton = screen.getByRole('button', { name: /Select Strand/i });
      await user.click(selectButton);
      expect(screen.getByTestId('strand-detail')).toBeInTheDocument();

      // Click back button
      const backButton = screen.getByRole('button', { name: /Back/i });
      await user.click(backButton);

      expect(screen.getByTestId('strands-list')).toBeInTheDocument();
    });

    it('returns to list view from create form when cancel is clicked', async () => {
      renderWithProviders(<StrandsApp />);

      // Go to create form
      const newStrandButton = screen.getByRole('button', { name: /\+ New Strand/i });
      await user.click(newStrandButton);
      expect(screen.getByText('Create New Strand')).toBeInTheDocument();

      // Click cancel button
      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      await user.click(cancelButton);

      expect(screen.getByTestId('strands-list')).toBeInTheDocument();
    });
  });

  describe('Create Strand', () => {
    it('creates a new strand successfully', async () => {
      renderWithProviders(<StrandsApp />);

      // Go to create form
      const newStrandButton = screen.getByRole('button', { name: /\+ New Strand/i });
      await user.click(newStrandButton);

      // Fill form
      const textarea = screen.getByPlaceholderText('Enter a thought, insight, or pasted content...');
      await user.type(textarea, 'Test strand content');

      // Add a tag
      const tagInput = screen.getByPlaceholderText('Add a tag...');
      await user.type(tagInput, 'test-tag');
      const addTagButton = screen.getByRole('button', { name: /Add/i });
      await user.click(addTagButton);

      // Submit form
      const submitButton = screen.getByRole('button', { name: /Create Strand/i });
      await user.click(submitButton);

      expect(defaultCreateStrand.createStrand).toHaveBeenCalledWith({
        content: 'Test strand content',
        source: 'manual',
        tags: ['test-tag'],
      });
    });

    it('shows error toast when creation fails', async () => {
      const mockCreateStrand = jest.fn().mockRejectedValue(new Error('Creation failed'));
      mockUseCreateStrand.mockReturnValue({
        createStrand: mockCreateStrand,
        loading: false,
        error: null,
      });

      renderWithProviders(<StrandsApp />);

      // Go to create form
      const newStrandButton = screen.getByRole('button', { name: /\+ New Strand/i });
      await user.click(newStrandButton);

      // Fill and submit
      const textarea = screen.getByPlaceholderText('Enter a thought, insight, or pasted content...');
      await user.type(textarea, 'Test');
      const submitButton = screen.getByRole('button', { name: /Create Strand/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByTestId('toast')).toBeInTheDocument();
        expect(screen.getByText(/There was an error saving your strand/)).toBeInTheDocument();
      });
    });
  });

  describe('Sync Functionality', () => {
    it('opens sync dropdown when Sync All button is clicked', async () => {
      renderWithProviders(<StrandsApp />);

      const syncButton = screen.getByRole('button', { name: /Sync All/i });
      await user.click(syncButton);

      expect(screen.getByText('Sync Unsynced Only')).toBeInTheDocument();
      expect(screen.getByText('Sync All Strands')).toBeInTheDocument();
    });

    it('initiates sync for unsynced strands', async () => {
      renderWithProviders(<StrandsApp />);

      // Open dropdown
      const syncButton = screen.getByRole('button', { name: /Sync All/i });
      await user.click(syncButton);

      // Click unsynced option
      const unsyncedOption = screen.getByText('Sync Unsynced Only');
      await user.click(unsyncedOption);

      expect(mockSyncService.syncMultiple).toHaveBeenCalled();
    });

    it('initiates sync for all strands', async () => {
      renderWithProviders(<StrandsApp />);

      // Open dropdown
      const syncButton = screen.getByRole('button', { name: /Sync All/i });
      await user.click(syncButton);

      // Click all option
      const allOption = screen.getByText('Sync All Strands');
      await user.click(allOption);

      expect(mockSyncService.syncMultiple).toHaveBeenCalled();
    });

    it('shows sync progress modal during sync', async () => {
      mockSyncService.syncMultiple.mockImplementation((strands, options) => {
        options.onProgress?.({
          total: strands.length,
          completed: 0,
          failed: 0,
          status: 'syncing',
          message: 'Syncing...',
        });
        return Promise.resolve([]);
      });

      renderWithProviders(<StrandsApp />);

      // Trigger sync
      const syncButton = screen.getByRole('button', { name: /Sync All/i });
      await user.click(syncButton);
      const unsyncedOption = screen.getByText('Sync Unsynced Only');
      await user.click(unsyncedOption);

      await waitFor(() => {
        expect(screen.getByTestId('sync-progress-modal')).toBeInTheDocument();
        expect(screen.getByText('Progress: syncing')).toBeInTheDocument();
      });
    });
  });

  describe('LLM Wizard', () => {
    it('closes wizard when complete button is clicked', async () => {
      mockUseLLMProfilesContext.mockReturnValue({
        profiles: [],
        loading: false,
      });
      renderWithProviders(<StrandsApp />);

      await waitFor(() => {
        expect(screen.getByTestId('llm-wizard')).toBeInTheDocument();
      });

      const completeButton = screen.getByRole('button', { name: /Complete/i });
      await user.click(completeButton);

      await waitFor(() => {
        expect(screen.queryByTestId('llm-wizard')).not.toBeInTheDocument();
      });
    });

    it('closes wizard when skip button is clicked', async () => {
      mockUseLLMProfilesContext.mockReturnValue({
        profiles: [],
        loading: false,
      });
      renderWithProviders(<StrandsApp />);

      await waitFor(() => {
        expect(screen.getByTestId('llm-wizard')).toBeInTheDocument();
      });

      const skipButton = screen.getByRole('button', { name: /Skip/i });
      await user.click(skipButton);

      await waitFor(() => {
        expect(screen.queryByTestId('llm-wizard')).not.toBeInTheDocument();
      });
    });
  });

  describe('Import Integrations', () => {
    it('shows toast when WhatsApp login is clicked', async () => {
      renderWithProviders(<StrandsApp />);

      const whatsappButton = screen.getByRole('button', { name: /Login WhatsApp/i });
      await user.click(whatsappButton);

      await waitFor(() => {
        expect(screen.getByTestId('toast')).toBeInTheDocument();
        expect(screen.getByText(/WhatsApp OAuth integration coming soon!/)).toBeInTheDocument();
      });
    });
  });

  describe('Error States', () => {
    it('shows loading state when profiles are loading', () => {
      mockUseLLMProfilesContext.mockReturnValue({
        profiles: [],
        loading: true,
      });
      renderWithProviders(<StrandsApp />);

      // Should not show wizard while loading
      expect(screen.queryByTestId('llm-wizard')).not.toBeInTheDocument();
    });

    it('handles sync service errors gracefully', async () => {
      mockSyncService.syncMultiple.mockRejectedValue(new Error('Sync failed'));
      renderWithProviders(<StrandsApp />);

      // Trigger sync
      const syncButton = screen.getByRole('button', { name: /Sync All/i });
      await user.click(syncButton);
      const unsyncedOption = screen.getByText('Sync Unsynced Only');
      await user.click(unsyncedOption);

      await waitFor(() => {
        expect(screen.getByTestId('sync-progress-modal')).toBeInTheDocument();
      });
    });
  });
});
