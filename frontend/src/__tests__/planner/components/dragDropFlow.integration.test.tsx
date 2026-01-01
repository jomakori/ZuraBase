/**
 * Integration tests for drag‑and‑drop workflows in the Planner module
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Board from '@/features/planner/components/Board';
import { Planner, PlannerLane, PlannerCard } from '@/features/planner/types';
import { setupMockHandlers, cleanupMockHandlers } from '@/shared/fixtures/mockHandlers';
import { mockPlanner } from '@/shared/fixtures/mockData';
import { simulateDragAndDrop } from '@/shared/fixtures/testUtils';

// Mock the drag‑and‑drop library with a more realistic mock that allows us to trigger onDragEnd
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
      }, 'Simulate card reorder within lane'),
      React.createElement('button', {
        'data-testid': 'mock-drag-card-between-lanes',
        onClick: () =>
          handleDragEnd({
            destination: { droppableId: 'lane-2', index: 1 },
            source: { droppableId: 'lane-1', index: 0 },
            draggableId: 'card-1',
            type: 'card',
          })
      }, 'Simulate card move between lanes'),
      React.createElement('button', {
        'data-testid': 'mock-drag-lane',
        onClick: () =>
          handleDragEnd({
            destination: { droppableId: 'all-lanes', index: 1 },
            source: { droppableId: 'all-lanes', index: 0 },
            draggableId: 'lane-1',
            type: 'lane',
          })
      }, 'Simulate lane reorder'),
      React.createElement('button', {
        'data-testid': 'mock-drag-cancel',
        onClick: () =>
          handleDragEnd({
            destination: null,
            source: { droppableId: 'lane-1', index: 0 },
            draggableId: 'card-1',
            type: 'card',
          })
      }, 'Simulate drag cancel (no destination)'),
      React.createElement('button', {
        'data-testid': 'mock-drag-same-position',
        onClick: () =>
          handleDragEnd({
            destination: { droppableId: 'lane-1', index: 0 },
            source: { droppableId: 'lane-1', index: 0 },
            draggableId: 'card-1',
            type: 'card',
          })
      }, 'Simulate drag same position')
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

// Mock the lane component to show cards and allow drag simulation
jest.mock('@/features/planner/components/Lane', () => ({
  __esModule: true,
  default: ({ lane, onAddCard, onUpdateCard, onDeleteCard, onUpdateLane, onDeleteLane, onSplitLane, onMoveCard }: any) => {
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

describe('Drag‑and‑Drop Flow Integration', () => {
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

  describe('Card reordering within same lane', () => {
    it('calls reorderCards API and updates planner when card is dragged within lane', async () => {
      renderBoard();
      // Simulate drag end via mock button
      fireEvent.click(screen.getByTestId('mock-drag-card-same-lane'));
      // Verify API call
      expect(plannerApi.reorderCards).toHaveBeenCalledWith(
        mockPlanner.id,
        'lane-1',
        expect.arrayContaining(['card-1', 'card-2']) // order after reorder
      );
      // Verify planner update
      await waitFor(() => {
        expect(mockOnPlannerUpdate).toHaveBeenCalled();
        const updatedPlanner = mockOnPlannerUpdate.mock.calls[0][0];
        const lane = updatedPlanner.lanes.find((l: PlannerLane) => l.id === 'lane-1');
        expect(lane.cards).toHaveLength(2);
        // Card order should be swapped (card-2 moved to index 0)
        expect(lane.cards[0].id).toBe('card-2');
        expect(lane.cards[1].id).toBe('card-1');
      });
    });

    it('does not call API when drag is cancelled (no destination)', async () => {
      renderBoard();
      fireEvent.click(screen.getByTestId('mock-drag-cancel'));
      expect(plannerApi.reorderCards).not.toHaveBeenCalled();
      expect(plannerApi.moveCard).not.toHaveBeenCalled();
      expect(plannerApi.reorderLanes).not.toHaveBeenCalled();
      expect(mockOnPlannerUpdate).not.toHaveBeenCalled();
    });

    it('does not call API when drag ends at same position', async () => {
      renderBoard();
      fireEvent.click(screen.getByTestId('mock-drag-same-position'));
      expect(plannerApi.reorderCards).not.toHaveBeenCalled();
      expect(mockOnPlannerUpdate).not.toHaveBeenCalled();
    });
  });

  describe('Card moving between lanes', () => {
    it('calls moveCard API and updates planner when card is dragged to another lane', async () => {
      renderBoard();
      fireEvent.click(screen.getByTestId('mock-drag-card-between-lanes'));
      // Verify API call
      expect(plannerApi.moveCard).toHaveBeenCalledWith(
        mockPlanner.id,
        'card-1',
        'lane-2',
        1
      );
      // Verify planner update
      await waitFor(() => {
        expect(mockOnPlannerUpdate).toHaveBeenCalled();
        const updatedPlanner = mockOnPlannerUpdate.mock.calls[0][0];
        const sourceLane = updatedPlanner.lanes.find((l: PlannerLane) => l.id === 'lane-1');
        const destLane = updatedPlanner.lanes.find((l: PlannerLane) => l.id === 'lane-2');
        expect(sourceLane.cards).toHaveLength(1); // card-1 removed
        expect(destLane.cards).toHaveLength(2); // card-3 plus card-1 added
        const movedCard = destLane.cards.find((c: PlannerCard) => c.id === 'card-1');
        expect(movedCard).toBeDefined();
      });
    });

    it('reverts planner state if moveCard API fails', async () => {
      (plannerApi.moveCard as jest.Mock).mockRejectedValue(new Error('API error'));
      // Spy on console.error to suppress error logs
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      renderBoard();
      fireEvent.click(screen.getByTestId('mock-drag-card-between-lanes'));
      // Wait for error handling
      await waitFor(() => {
        // Should have called moveCard
        expect(plannerApi.moveCard).toHaveBeenCalled();
        // Should have reverted planner state (original planner unchanged)
        // Since we can't easily capture the revert, we can verify that onPlannerUpdate was called twice:
        // once for optimistic update, once for revert.
        // The mockOnPlannerUpdate mock.calls length should be 2.
        expect(mockOnPlannerUpdate.mock.calls.length).toBe(2);
        const revertPlanner = mockOnPlannerUpdate.mock.calls[1][0];
        // Revert should match original planner
        expect(revertPlanner.lanes).toEqual(mockPlanner.lanes);
      });
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Lane reordering', () => {
    it('calls reorderLanes API and updates planner when lane is dragged', async () => {
      renderBoard();
      fireEvent.click(screen.getByTestId('mock-drag-lane'));
      // Verify API call
      expect(plannerApi.reorderLanes).toHaveBeenCalledWith(
        mockPlanner.id,
        expect.arrayContaining(['lane-2', 'lane-1']) // order after reorder
      );
      // Verify planner update
      await waitFor(() => {
        expect(mockOnPlannerUpdate).toHaveBeenCalled();
        const updatedPlanner = mockOnPlannerUpdate.mock.calls[0][0];
        expect(updatedPlanner.lanes[0].id).toBe('lane-2');
        expect(updatedPlanner.lanes[1].id).toBe('lane-1');
      });
    });

    it('reverts planner state if reorderLanes API fails', async () => {
      (plannerApi.reorderLanes as jest.Mock).mockRejectedValue(new Error('API error'));
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      renderBoard();
      fireEvent.click(screen.getByTestId('mock-drag-lane'));
      await waitFor(() => {
        expect(plannerApi.reorderLanes).toHaveBeenCalled();
        // Should have reverted
        expect(mockOnPlannerUpdate.mock.calls.length).toBe(2);
        const revertPlanner = mockOnPlannerUpdate.mock.calls[1][0];
        expect(revertPlanner.lanes).toEqual(mockPlanner.lanes);
      });
      consoleErrorSpy.mockRestore();
    });
  });

  describe('Error recovery and user feedback', () => {
    it('shows alert when drag‑and‑drop operation fails', async () => {
      (plannerApi.reorderCards as jest.Mock).mockRejectedValue(new Error('API error'));
      const alertSpy = jest.spyOn(window, 'alert').mockImplementation();
      renderBoard();
      fireEvent.click(screen.getByTestId('mock-drag-card-same-lane'));
      await waitFor(() => {
        expect(alertSpy).toHaveBeenCalledWith('Failed to save changes. Please try again.');
      });
      alertSpy.mockRestore();
    });
  });

  describe('Integration with simulated DOM drag‑and‑drop', () => {
    // This test uses the simulateDragAndDrop helper to test the DOM events.
    // Since the drag‑and‑drop library is mocked, the actual drag events won't trigger onDragEnd.
    // We'll skip this test for now, but keep the structure for future reference.
    it.skip('simulates drag‑and‑drop using DOM events', async () => {
      // This test would require a more sophisticated mock or using the real library.
      // We'll leave it as a placeholder.
    });
  });
});
