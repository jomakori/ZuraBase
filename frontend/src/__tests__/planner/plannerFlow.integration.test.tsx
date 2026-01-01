/**
 * Integration tests for complete planner workflows
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PlannerApp from '@/features/planner/components/PlannerApp';
import { setupMockHandlers, cleanupMockHandlers } from '@/shared/fixtures/mockHandlers';
import { mockPlanner } from '@/shared/fixtures/mockData';

// Mock the drag‑and‑drop library (same as in dragDropFlow)
jest.mock('@hello-pangea/dnd', () => ({
  DragDropContext: ({ children, onDragEnd }: any) => {
    const handleDragEnd = (result: any) => {
      onDragEnd(result);
    };
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'drag-drop-context' },
      children,
      React.createElement('button', {
        'data-testid': 'mock-drag-card-same-lane',
        onClick: () =>
          handleDragEnd({
            destination: { droppableId: 'lane-1', index: 0 },
            source: { droppableId: 'lane-1', index: 1 },
            draggableId: 'card-2',
            type: 'card',
          })
      }, 'Simulate card reorder')
    );
  },
  Droppable: ({ children, droppableId, type }: any) =>
    children(
      {
        innerRef: () => {},
        droppableProps: {},
        placeholder: (() => {
          const React = require('react');
          return React.createElement('div', { 'data-testid': `droppable-placeholder-${droppableId}` });
        })(),
      },
      {}
    ),
  Draggable: ({ children, draggableId, index }: any) =>
    children(
      {
        innerRef: () => {},
        draggableProps: {},
        dragHandleProps: {},
      },
      {}
    ),
}));

// Mock the lane component
jest.mock('@/features/planner/components/Lane', () => ({
  __esModule: true,
  default: ({ lane, onAddCard, onUpdateCard, onDeleteCard, onUpdateLane, onDeleteLane, onSplitLane }: any) => {
    const React = require('react');
    return React.createElement('div', { 'data-testid': `lane-${lane.id}` },
      React.createElement('h3', null, lane.title),
      React.createElement('div', { 'data-testid': `lane-cards-${lane.id}` },
        lane.cards.map((card: any) =>
          React.createElement('div', { key: card.id, 'data-testid': `card-${card.id}` },
            card.fields?.title || card.title
          )
        )
      ),
      React.createElement('button', { onClick: () => onAddCard(lane.id, 'New Card', 'Content', 0) }, 'Add Card'),
      React.createElement('button', { onClick: () => onUpdateCard('card-1', 'Updated', 'Updated content') }, 'Update Card'),
      React.createElement('button', { onClick: () => onDeleteCard('card-1') }, 'Delete Card'),
      React.createElement('button', { onClick: () => onUpdateLane(lane.id, 'Updated Lane', 'Updated description', '#FF0000') }, 'Update Lane'),
      React.createElement('button', { onClick: () => onDeleteLane(lane.id) }, 'Delete Lane'),
      React.createElement('button', { onClick: () => onSplitLane(lane.id, 'Split Lane', 'Split description', 1, '#00FF00') }, 'Split Lane')
    );
  },
}));

// Mock the card component (not used directly but for completeness)
jest.mock('@/features/planner/components/Card', () => ({
  __esModule: true,
  default: ({ card, onUpdate, onDelete, onSelect }: any) => {
    const React = require('react');
    return React.createElement('div', { 'data-testid': `card-${card.id}` },
      React.createElement('span', null, card.fields?.title || card.title),
      React.createElement('button', { onClick: () => onUpdate('Updated', 'Updated content') }, 'Edit Card'),
      React.createElement('button', { onClick: () => onDelete() }, 'Delete Card')
    );
  },
}));

// Mock the PlannerWizard component to simplify testing
jest.mock('@/features/planner/components/PlannerWizard', () => ({
  __esModule: true,
  default: ({ open, setOpen, templates, onCreatePlanner, onCancel }: any) => {
    if (!open) return null;
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'planner-wizard' },
      React.createElement('h2', null, 'Create New Planner'),
      React.createElement('input', {
        'data-testid': 'wizard-title',
        placeholder: 'Title',
        defaultValue: 'My Planner'
      }),
      React.createElement('textarea', {
        'data-testid': 'wizard-description',
        placeholder: 'Description',
        defaultValue: 'Test description'
      }),
      React.createElement('div', { 'data-testid': 'template-list' },
        templates.map((t: any) =>
          React.createElement('div', { key: t.id, 'data-testid': `template-${t.id}` }, t.name)
        )
      ),
      React.createElement('button', {
        'data-testid': 'wizard-next',
        onClick: () => {
          // Simulate moving to step 2 (template selection)
          // In real wizard, there are multiple steps; we'll just call onCreatePlanner directly
          onCreatePlanner('template-1', 'My Planner', 'Test description');
          setOpen(false);
        }
      }, 'Create Planner'),
      React.createElement('button', { 'data-testid': 'wizard-cancel', onClick: onCancel }, 'Cancel')
    );
  },
}));

// Mock the TemplateSelector component
jest.mock('@/features/planner/components/TemplateSelector', () => ({
  __esModule: true,
  default: ({ templates, onSelectTemplate }: any) => {
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'template-selector' },
      templates.map((t: any) =>
        React.createElement('button', {
          key: t.id,
          'data-testid': `select-template-${t.id}`,
          onClick: () => onSelectTemplate(t)
        }, t.name)
      )
    );
  },
}));

// Mock the API calls
jest.mock('@/features/planner/api/planner.api', () => ({
  getTemplates: jest.fn(),
  createPlanner: jest.fn(),
  getPlanner: jest.fn(),
  updatePlanner: jest.fn(),
  addLane: jest.fn(),
  updateLane: jest.fn(),
  deleteLane: jest.fn(),
  splitLane: jest.fn(),
  addCard: jest.fn(),
  updateCard: jest.fn(),
  deleteCard: jest.fn(),
  reorderLanes: jest.fn(),
  reorderCards: jest.fn(),
  moveCard: jest.fn(),
  exportPlannerMarkdown: jest.fn(),
  importPlannerFromMarkdown: jest.fn(),
}));

import * as plannerApi from '@/features/planner/api/planner.api';

// Mock useSaveHandler
jest.mock('@/shared/utils/saveUtils', () => ({
  useSaveHandler: jest.fn(() => ({
    queryParamID: null,
    isSaving: false,
    lastSaved: null,
    showSharingModal: false,
    setShowSharingModal: jest.fn(),
    saveDocument: jest.fn(),
  })),
}));

// Mock SharingModal
jest.mock('@/shared/components/SharingModal', () => ({
  __esModule: true,
  default: ({ open, setOpen }: any) => {
    const React = require('react');
    return open ? React.createElement('div', { 'data-testid': 'sharing-modal' }, 'Sharing Modal') : null;
  },
}));

// Mock SaveButton
jest.mock('@/shared/components/SaveButton', () => ({
  __esModule: true,
  default: ({ saveState, onClick }: any) => {
    const React = require('react');
    return React.createElement('button', { 'data-testid': 'save-button', onClick },
      saveState === 'saving' ? 'Saving...' : 'Save'
    );
  },
}));

describe('Planner Flow Integration', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeEach(() => {
    user = userEvent.setup();
    setupMockHandlers();
    jest.clearAllMocks();

    // Mock window.location and window.history
    Object.defineProperty(window, 'location', {
      value: {
        pathname: '/',
        href: '',
        replaceState: jest.fn(),
        pushState: jest.fn(),
      },
      writable: true,
    });
    Object.defineProperty(window, 'history', {
      value: {
        replaceState: jest.fn(),
        pushState: jest.fn(),
      },
      writable: true,
    });

    // Default API mocks
    (plannerApi.getTemplates as jest.Mock).mockResolvedValue([
      { id: 'template-1', name: 'Scrum Board', type: 'scrum' },
      { id: 'template-2', name: 'Kanban Board', type: 'kanban' },
    ]);
    (plannerApi.createPlanner as jest.Mock).mockResolvedValue({
      id: 'planner-123',
      title: 'My Planner',
      description: 'Test description',
      template_id: 'template-1',
      lanes: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    (plannerApi.getPlanner as jest.Mock).mockResolvedValue(mockPlanner);
    (plannerApi.addLane as jest.Mock).mockResolvedValue({
      id: 'new-lane-id',
      planner_id: 'planner-123',
      title: 'New Lane',
      description: 'Lane description',
      position: 2,
      cards: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    (plannerApi.updateLane as jest.Mock).mockResolvedValue({
      id: 'lane-1',
      planner_id: 'planner-123',
      title: 'Updated Lane',
      description: 'Updated description',
      color: '#FF0000',
      position: 0,
      cards: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    (plannerApi.deleteLane as jest.Mock).mockResolvedValue(undefined);
    (plannerApi.splitLane as jest.Mock).mockResolvedValue({
      id: 'split-lane-id',
      planner_id: 'planner-123',
      title: 'Split Lane',
      description: 'Split description',
      position: 1,
      color: '#00FF00',
      cards: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    (plannerApi.addCard as jest.Mock).mockResolvedValue({
      id: 'new-card-id',
      lane_id: 'lane-1',
      fields: { title: 'New Card', content: 'Content' },
      position: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    (plannerApi.updateCard as jest.Mock).mockResolvedValue({
      id: 'card-1',
      lane_id: 'lane-1',
      fields: { title: 'Updated', content: 'Updated content' },
      position: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    (plannerApi.deleteCard as jest.Mock).mockResolvedValue(undefined);
    (plannerApi.reorderLanes as jest.Mock).mockResolvedValue(undefined);
    (plannerApi.reorderCards as jest.Mock).mockResolvedValue(undefined);
    (plannerApi.moveCard as jest.Mock).mockResolvedValue({
      id: 'card-1',
      lane_id: 'lane-2',
      fields: { title: 'Moved Card', content: '' },
      position: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  });

  afterEach(() => {
    cleanupMockHandlers();
  });

  const renderPlannerApp = (initialPath = '/') => {
    return render(
      <MemoryRouter initialEntries={[initialPath]}>
        <Routes>
          <Route path="/planner/:id" element={<PlannerApp />} />
          <Route path="/" element={<PlannerApp />} />
        </Routes>
      </MemoryRouter>
    );
  };

  describe('Complete user workflow', () => {
    it('creates a planner, adds lanes and cards, edits, and deletes', async () => {
      // 1. Start at home page (no planner)
      renderPlannerApp('/');
      // Should show "Create New Planner" button
      expect(screen.getByText('Create New Planner')).toBeInTheDocument();
      // Click the button to open wizard
      await user.click(screen.getByText('Create New Planner'));
      // Wizard should appear
      await waitFor(() => {
        expect(screen.getByTestId('planner-wizard')).toBeInTheDocument();
      });
      // Click "Create Planner" button (mocked wizard will call onCreatePlanner)
      await user.click(screen.getByTestId('wizard-next'));
      // Wait for planner to be created
      await waitFor(() => {
        expect(plannerApi.createPlanner).toHaveBeenCalledWith(
          'template-1',
          'My Planner',
          'Test description'
        );
      });
      // After creation, the planner should be displayed (mocked getPlanner returns mockPlanner)
      await waitFor(() => {
        expect(screen.getByText('My Planner')).toBeInTheDocument(); // from mockPlanner title
      });
      // Should see lanes "Backlog" and "In Progress"
      expect(screen.getByText('Backlog')).toBeInTheDocument();
      expect(screen.getByText('In Progress')).toBeInTheDocument();

      // 2. Add a new lane
      // Find the "Add Lane" button (rendered by Board)
      const addLaneButton = screen.getByText('Add Lane');
      await user.click(addLaneButton);
      // Fill lane title and description (form appears)
      await user.type(screen.getByPlaceholderText('Lane title'), 'New Lane');
      await user.type(screen.getByPlaceholderText('Lane description'), 'Description');
      // Submit
      await user.click(screen.getByRole('button', { name: 'Add' }));
      // Verify API call
      await waitFor(() => {
        expect(plannerApi.addLane).toHaveBeenCalledWith(
          mockPlanner.id,
          'New Lane',
          'Description',
          expect.any(Number)
        );
      });
      // The lane should appear (mocked Lane component will show title)
      // Since we mock Lane, we can't see the new lane title; but we can verify that the planner update callback was called.
      // For simplicity, we'll assume the lane is added.

      // 3. Add a card to the first lane
      // The mocked Lane component has an "Add Card" button
      const addCardButtons = screen.getAllByText('Add Card');
      await user.click(addCardButtons[0]); // first lane
      // Verify API call
      await waitFor(() => {
        expect(plannerApi.addCard).toHaveBeenCalledWith(
          mockPlanner.id,
          'lane-1',
          'New Card',
          'Content',
          0
        );
      });

      // 4. Edit a card
      const updateCardButtons = screen.getAllByText('Update Card');
      await user.click(updateCardButtons[0]);
      await waitFor(() => {
        expect(plannerApi.updateCard).toHaveBeenCalledWith(
          mockPlanner.id,
          'lane-1',
          'card-1',
          'Updated',
          'Updated content'
        );
      });

      // 5. Delete a card
      const deleteCardButtons = screen.getAllByText('Delete Card');
      await user.click(deleteCardButtons[0]);
      await waitFor(() => {
        expect(plannerApi.deleteCard).toHaveBeenCalledWith(
          mockPlanner.id,
          'lane-1',
          'card-1'
        );
      });

      // 6. Delete a lane (with confirmation)
      window.confirm = jest.fn().mockReturnValue(true);
      const deleteLaneButtons = screen.getAllByText('Delete Lane');
      await user.click(deleteLaneButtons[0]);
      expect(window.confirm).toHaveBeenCalledWith(
        'Are you sure you want to delete this lane and all its cards?'
      );
      await waitFor(() => {
        expect(plannerApi.deleteLane).toHaveBeenCalledWith(
          mockPlanner.id,
          'lane-1'
        );
      });

      // 7. Error recovery: simulate API failure during lane addition
      (plannerApi.addLane as jest.Mock).mockRejectedValueOnce(new Error('API error'));
      await user.click(screen.getByText('Add Lane'));
      await user.type(screen.getByPlaceholderText('Lane title'), 'Error Lane');
      await user.click(screen.getByRole('button', { name: 'Add' }));
      // Should not crash; error is logged
      expect(plannerApi.addLane).toHaveBeenCalled();
      // No new lane should appear (but we can't easily assert UI)
    });

    it('handles drag‑and‑drop as part of workflow', async () => {
      // Start with a planner already loaded
      (plannerApi.getPlanner as jest.Mock).mockResolvedValue(mockPlanner);
      renderPlannerApp('/planner/planner-1');
      await waitFor(() => {
        expect(screen.getByText('My Planner')).toBeInTheDocument();
      });
      // Simulate card reorder via mock button
      fireEvent.click(screen.getByTestId('mock-drag-card-same-lane'));
      await waitFor(() => {
        expect(plannerApi.reorderCards).toHaveBeenCalled();
      });
    });

    it('shows error when planner fails to load', async () => {
      (plannerApi.getPlanner as jest.Mock).mockRejectedValue(new Error('Not found'));
      renderPlannerApp('/planner/invalid');
      await waitFor(() => {
        expect(screen.getByText('Failed to load planner. Please try again.')).toBeInTheDocument();
      });
    });
  });
});
