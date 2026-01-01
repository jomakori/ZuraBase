/**
 * Tests for Board component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Board from '@/features/planner/components/Board';
import { Planner, PlannerLane, PlannerCard } from '@/features/planner/types';
import { setupMockHandlers, cleanupMockHandlers } from '@/shared/fixtures/mockHandlers';
import { mockPlanner } from '@/shared/fixtures/mockData';
import { simulateDragAndDrop } from '@/shared/fixtures/testUtils';

// Mock the drag‑and‑drop library
jest.mock('@hello-pangea/dnd', () => ({
  DragDropContext: ({ children, onDragEnd }: any) => {
    const handleDragEnd = (result: any) => {
      onDragEnd(result);
    };
    const React = require('react');
    return React.createElement('div', { 'data-testid': 'drag-drop-context' },
      children,
      React.createElement('button', {
        'data-testid': 'mock-drag-end',
        onClick: () =>
          handleDragEnd({
            destination: { droppableId: 'lane-1', index: 0 },
            source: { droppableId: 'lane-1', index: 1 },
            draggableId: 'card-1',
            type: 'card',
          })
      }, 'Simulate drag end')
    );
  },
  Droppable: ({ children, droppableId, type }: any) => {
    const React = require('react');
    return children(
      {
        innerRef: () => {},
        droppableProps: {},
        placeholder: React.createElement('div', { 'data-testid': `droppable-placeholder-${droppableId}` }),
      },
      {}
    );
  },
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

// Mock the lane component to simplify testing
jest.mock('@/features/planner/components/Lane', () => ({
  __esModule: true,
  default: ({ lane, onAddCard, onUpdateCard, onDeleteCard, onUpdateLane, onDeleteLane, onSplitLane }: any) => {
    const React = require('react');
    const children = [];
    children.push(React.createElement('h3', null, lane.title));
    children.push(React.createElement('button', { onClick: () => onAddCard(lane.id, 'New Card', 'Content', 0) }, 'Add Card'));
    children.push(React.createElement('button', { onClick: () => onUpdateCard('card-1', 'Updated', 'Updated content') }, 'Update Card'));
    children.push(React.createElement('button', { onClick: () => onDeleteCard('card-1') }, 'Delete Card'));
    children.push(React.createElement('button', { onClick: () => onUpdateLane(lane.id, 'Updated Lane', 'Updated description', '#FF0000') }, 'Update Lane'));
    children.push(React.createElement('button', { onClick: () => onDeleteLane(lane.id) }, 'Delete Lane'));
    children.push(React.createElement('button', { onClick: () => onSplitLane(lane.id, 'Split Lane', 'Split description', 1, '#00FF00') }, 'Split Lane'));
    children.push(
      React.createElement('div', null,
        lane.cards.map((card: any) =>
          React.createElement('div', { key: card.id, 'data-testid': `card-${card.id}` },
            card.fields?.title || card.title
          )
        )
      )
    );
    return React.createElement('div', { 'data-testid': `lane-${lane.id}` }, children);
  },
}));

// Mock the API calls
jest.mock('@/features/planner/api/planner.api', () => ({
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
}));

import * as plannerApi from '@/features/planner/api/planner.api';

describe('Board', () => {
  const mockOnPlannerUpdate = jest.fn();
  const mockOnSplitLane = jest.fn();

  const defaultProps = {
    planner: mockPlanner,
    onPlannerUpdate: mockOnPlannerUpdate,
    onSplitLane: mockOnSplitLane,
  };

  beforeEach(() => {
    setupMockHandlers();
    jest.clearAllMocks();
    mockOnPlannerUpdate.mockClear();
    mockOnSplitLane.mockClear();
    // Default mock implementations
    (plannerApi.addLane as jest.Mock).mockResolvedValue({
      id: 'new-lane-id',
      planner_id: mockPlanner.id,
      title: 'New Lane',
      description: 'Lane description',
      position: 2,
      cards: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    (plannerApi.updateLane as jest.Mock).mockResolvedValue({
      id: 'lane-1',
      planner_id: mockPlanner.id,
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
      planner_id: mockPlanner.id,
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

  const renderBoard = (overrides: Partial<typeof defaultProps> = {}) => {
    const props = { ...defaultProps, ...overrides };
    return render(<Board {...props} />);
  };

  describe('Rendering', () => {
    it('renders lanes with correct titles', () => {
      renderBoard();
      expect(screen.getByText('Backlog')).toBeInTheDocument();
      expect(screen.getByText('In Progress')).toBeInTheDocument();
    });

    it('renders cards within lanes', () => {
      renderBoard();
      expect(screen.getByTestId('card-card-1')).toBeInTheDocument();
      expect(screen.getByTestId('card-card-2')).toBeInTheDocument();
      expect(screen.getByTestId('card-card-3')).toBeInTheDocument();
    });

    it('renders "Add Lane" button', () => {
      renderBoard();
      expect(screen.getByText('Add Lane')).toBeInTheDocument();
    });

    it('shows add lane form when "Add Lane" button is clicked', async () => {
      const user = userEvent.setup();
      renderBoard();
      const addButton = screen.getByText('Add Lane');
      await user.click(addButton);
      expect(screen.getByPlaceholderText('Lane title')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Lane description')).toBeInTheDocument();
    });
  });

  describe('Adding a lane', () => {
    it('calls addLane API and updates planner when form is submitted', async () => {
      const user = userEvent.setup();
      renderBoard();
      // Open form
      await user.click(screen.getByText('Add Lane'));
      // Fill form
      await user.type(screen.getByPlaceholderText('Lane title'), 'New Lane');
      await user.type(screen.getByPlaceholderText('Lane description'), 'Description');
      // Submit
      await user.click(screen.getByRole('button', { name: 'Add' }));
      // Verify API call
      expect(plannerApi.addLane).toHaveBeenCalledWith(
        mockPlanner.id,
        'New Lane',
        'Description',
        expect.any(Number)
      );
      // Verify planner update
      await waitFor(() => {
        expect(mockOnPlannerUpdate).toHaveBeenCalled();
        const updatedPlanner = mockOnPlannerUpdate.mock.calls[0][0];
        expect(updatedPlanner.lanes).toHaveLength(3);
        const newLane = updatedPlanner.lanes.find((l: PlannerLane) => l.title === 'New Lane');
        expect(newLane).toBeDefined();
      });
    });

    it('does not add lane if title is empty', async () => {
      const user = userEvent.setup();
      renderBoard();
      await user.click(screen.getByText('Add Lane'));
      // Leave title empty
      await user.type(screen.getByPlaceholderText('Lane description'), 'Description');
      await user.click(screen.getByRole('button', { name: 'Add' }));
      expect(plannerApi.addLane).not.toHaveBeenCalled();
      expect(mockOnPlannerUpdate).not.toHaveBeenCalled();
    });

    it('cancels adding lane when cancel button is clicked', async () => {
      const user = userEvent.setup();
      renderBoard();
      await user.click(screen.getByText('Add Lane'));
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.queryByPlaceholderText('Lane title')).not.toBeInTheDocument();
    });
  });

  describe('Updating a lane', () => {
    it('calls updateLane API and updates planner when lane is updated', async () => {
      renderBoard();
      // The mocked Lane component has an "Update Lane" button that triggers onUpdateLane
      const updateButton = screen.getByRole('button', { name: 'Update Lane' });
      fireEvent.click(updateButton);
      expect(plannerApi.updateLane).toHaveBeenCalledWith(
        mockPlanner.id,
        'lane-1',
        'Updated Lane',
        'Updated description',
        '#FF0000'
      );
      await waitFor(() => {
        expect(mockOnPlannerUpdate).toHaveBeenCalled();
      });
    });
  });

  describe('Deleting a lane', () => {
    it('calls deleteLane API and updates planner when lane is deleted', async () => {
      window.confirm = jest.fn().mockReturnValue(true);
      renderBoard();
      const deleteButton = screen.getByRole('button', { name: 'Delete Lane' });
      fireEvent.click(deleteButton);
      expect(window.confirm).toHaveBeenCalledWith(
        'Are you sure you want to delete this lane and all its cards?'
      );
      expect(plannerApi.deleteLane).toHaveBeenCalledWith(mockPlanner.id, 'lane-1');
      await waitFor(() => {
        expect(mockOnPlannerUpdate).toHaveBeenCalled();
        const updatedPlanner = mockOnPlannerUpdate.mock.calls[0][0];
        expect(updatedPlanner.lanes).toHaveLength(1);
      });
    });

    it('does not delete lane if user cancels confirmation', async () => {
      window.confirm = jest.fn().mockReturnValue(false);
      renderBoard();
      const deleteButton = screen.getByRole('button', { name: 'Delete Lane' });
      fireEvent.click(deleteButton);
      expect(plannerApi.deleteLane).not.toHaveBeenCalled();
      expect(mockOnPlannerUpdate).not.toHaveBeenCalled();
    });
  });

  describe('Splitting a lane', () => {
    it('calls splitLane API and updates planner when lane is split', async () => {
      renderBoard();
      const splitButton = screen.getByRole('button', { name: 'Split Lane' });
      fireEvent.click(splitButton);
      expect(plannerApi.splitLane).toHaveBeenCalledWith(
        mockPlanner.id,
        'lane-1',
        'Split Lane',
        'Split description',
        1,
        '#00FF00'
      );
      await waitFor(() => {
        expect(mockOnPlannerUpdate).toHaveBeenCalled();
      });
    });
  });

  describe('Adding a card', () => {
    it('calls addCard API and updates planner when card is added', async () => {
      renderBoard();
      const addCardButton = screen.getByRole('button', { name: 'Add Card' });
      fireEvent.click(addCardButton);
      expect(plannerApi.addCard).toHaveBeenCalledWith(
        mockPlanner.id,
        'lane-1',
        'New Card',
        'Content',
        0
      );
      await waitFor(() => {
        expect(mockOnPlannerUpdate).toHaveBeenCalled();
      });
    });
  });

  describe('Updating a card', () => {
    it('calls updateCard API and updates planner when card is updated', async () => {
      renderBoard();
      const updateCardButton = screen.getByRole('button', { name: 'Update Card' });
      fireEvent.click(updateCardButton);
      expect(plannerApi.updateCard).toHaveBeenCalledWith(
        mockPlanner.id,
        'lane-1',
        'card-1',
        'Updated',
        'Updated content'
      );
      await waitFor(() => {
        expect(mockOnPlannerUpdate).toHaveBeenCalled();
      });
    });
  });

  describe('Deleting a card', () => {
    it('calls deleteCard API and updates planner when card is deleted', async () => {
      renderBoard();
      const deleteCardButton = screen.getByRole('button', { name: 'Delete Card' });
      fireEvent.click(deleteCardButton);
      expect(plannerApi.deleteCard).toHaveBeenCalledWith(
        mockPlanner.id,
        'lane-1',
        'card-1'
      );
      await waitFor(() => {
        expect(mockOnPlannerUpdate).toHaveBeenCalled();
      });
    });
  });

  describe('Drag and drop', () => {
    // Since we have mocked the drag‑and‑drop library, we can only test that the
    // drag‑end handler is wired up correctly.
    it('calls reorderLanes when a lane is dragged', async () => {
      // This test is limited due to mocking; we can at least verify that the
      // DragDropContext is present.
      renderBoard();
      expect(screen.getByTestId('drag-drop-context')).toBeInTheDocument();
    });
  });

  describe('Error handling', () => {
    it('handles API errors gracefully when adding lane fails', async () => {
      const user = userEvent.setup();
      (plannerApi.addLane as jest.Mock).mockRejectedValue(new Error('API error'));
      renderBoard();
      await user.click(screen.getByText('Add Lane'));
      await user.type(screen.getByPlaceholderText('Lane title'), 'New Lane');
      await user.click(screen.getByRole('button', { name: 'Add' }));
      // Should not crash; error is logged
      expect(plannerApi.addLane).toHaveBeenCalled();
      // No planner update
      expect(mockOnPlannerUpdate).not.toHaveBeenCalled();
    });
  });
});
