/**
 * Tests for Planner API client
 */

import {
  getTemplates,
  getTemplate,
  createPlanner,
  getPlanner,
  updatePlanner,
  deletePlanner,
  addLane,
  updateLane,
  deleteLane,
  splitLane,
  getCard,
  initializeTemplates,
  reorderLanes,
  addCard,
  updateCard,
  deleteCard,
  reorderCards,
  moveCard,
  exportPlannerMarkdown,
  importPlannerFromMarkdown,
} from '@/features/planner/api/planner.api';
import { setupMockHandlers, cleanupMockHandlers } from '@/shared/fixtures/mockHandlers';
import { mockPlanner } from '@/shared/fixtures/mockData';

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

// Mock window.history.replaceState
const mockReplaceState = jest.fn();
Object.defineProperty(window, 'history', {
  value: { replaceState: mockReplaceState },
  writable: true,
});

describe('Planner API', () => {
  beforeEach(() => {
    setupMockHandlers();
    jest.clearAllMocks();
    mockReplaceState.mockClear();
  });

  afterEach(() => {
    cleanupMockHandlers();
  });

  describe('Template API', () => {
    describe('getTemplates', () => {
      it('fetches templates successfully', async () => {
        const result = await getTemplates();
        expect(result).toBeDefined();
        expect(Array.isArray(result)).toBe(true);
        const calls = (global.fetch as jest.Mock).mock.calls;
        expect(calls[0][0]).toContain('/planner/templates');
      });

      it('throws error when fetch fails', async () => {
        global.fetch = jest.fn().mockResolvedValue({
          ok: false,
          status: 500,
          text: () => Promise.resolve('Internal server error'),
        });

        await expect(getTemplates()).rejects.toThrow('Internal server error');
      });
    });

    describe('getTemplate', () => {
      it('fetches a single template successfully', async () => {
        const templateId = 'template-1';
        const result = await getTemplate(templateId);
        expect(result).toBeDefined();
        const calls = (global.fetch as jest.Mock).mock.calls;
        expect(calls[0][0]).toContain(`/planner/templates/${templateId}`);
      });

      it('throws error when template not found', async () => {
        global.fetch = jest.fn().mockResolvedValue({
          ok: false,
          status: 404,
          text: () => Promise.resolve('Template not found'),
        });

        await expect(getTemplate('nonexistent')).rejects.toThrow('Template not found');
      });
    });

    describe('initializeTemplates', () => {
      it('calls init endpoint successfully', async () => {
        await initializeTemplates();
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/planner/templates/init'),
          expect.objectContaining({
            method: 'POST',
          })
        );
      });

      it('throws error when init fails', async () => {
        global.fetch = jest.fn().mockResolvedValue({
          ok: false,
          status: 500,
          text: () => Promise.resolve('Init failed'),
        });

        await expect(initializeTemplates()).rejects.toThrow('Init failed');
      });
    });
  });

  describe('Planner CRUD', () => {
    describe('createPlanner', () => {
      it('creates a planner successfully', async () => {
        const templateId = 'template-1';
        const title = 'My Planner';
        const description = 'Test description';
        const result = await createPlanner(templateId, title, description);
        expect(result).toHaveProperty('id');
        expect(result.title).toBe(title);
        expect(result.description).toBe(description);
        expect(result.template_id).toBe(templateId);
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/planner'),
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ template_id: templateId, title, description }),
            credentials: 'include',
          })
        );
      });

      it('creates temporary planner when backend fails', async () => {
        global.fetch = jest.fn().mockResolvedValue({
          ok: false,
          status: 500,
          text: () => Promise.resolve('Backend error'),
        });

        const result = await createPlanner('template-1', 'Temp', 'Desc');
        expect(result.id).toMatch(/^temp-/);
        expect(result.title).toBe('Temp');
        expect(result.description).toBe('Desc');
        expect(result.template_id).toBe('template-1');
        expect(result.lanes).toEqual([]);
        // Should have called replaceState
        expect(mockReplaceState).toHaveBeenCalled();
      });

      it('creates temporary planner on network error', async () => {
        global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

        const result = await createPlanner('template-1', 'Temp', 'Desc');
        expect(result.id).toMatch(/^temp-/);
        expect(mockReplaceState).toHaveBeenCalled();
      });
    });

    describe('getPlanner', () => {
      it('fetches a planner successfully', async () => {
        const plannerId = 'planner-1';
        const result = await getPlanner(plannerId);
        expect(result).toEqual(mockPlanner);
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining(`/planner/${plannerId}`),
          expect.objectContaining({
            credentials: 'include',
          })
        );
      });

      it('throws error when planner not found', async () => {
        global.fetch = jest.fn().mockResolvedValue({
          ok: false,
          status: 404,
          text: () => Promise.resolve('Planner not found'),
        });

        await expect(getPlanner('nonexistent')).rejects.toThrow('Planner not found');
      });
    });

    describe('updatePlanner', () => {
      it('updates a planner successfully', async () => {
        const plannerId = 'planner-1';
        const title = 'Updated Title';
        const description = 'Updated description';
        const result = await updatePlanner(plannerId, title, description);
        expect(result).toBeDefined();
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining(`/planner/${plannerId}`),
          expect.objectContaining({
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description }),
          })
        );
      });

      it('throws error when update fails', async () => {
        global.fetch = jest.fn().mockResolvedValue({
          ok: false,
          status: 500,
          text: () => Promise.resolve('Update failed'),
        });

        await expect(updatePlanner('planner-1', 'Title', 'Desc')).rejects.toThrow('Update failed');
      });
    });

    describe('deletePlanner', () => {
      it('deletes a planner successfully', async () => {
        const plannerId = 'planner-1';
        await deletePlanner(plannerId);
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining(`/planner/${plannerId}`),
          expect.objectContaining({
            method: 'DELETE',
          })
        );
      });

      it('throws error when delete fails', async () => {
        global.fetch = jest.fn().mockResolvedValue({
          ok: false,
          status: 404,
          text: () => Promise.resolve('Planner not found'),
        });

        await expect(deletePlanner('nonexistent')).rejects.toThrow('Planner not found');
      });
    });
  });

  describe('Lane API', () => {
    describe('addLane', () => {
      it('adds a lane successfully', async () => {
        const plannerId = 'planner-1';
        const title = 'New Lane';
        const description = 'Lane description';
        const position = 2;
        const color = '#FF0000';
        const result = await addLane(plannerId, title, description, position, color);
        expect(result).toBeDefined();
        expect(result.title).toBe(title);
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining(`/planner/${plannerId}/lane`),
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description, position, color }),
          })
        );
      });

      it('adds lane without optional color', async () => {
        const plannerId = 'planner-1';
        const title = 'New Lane';
        const description = 'Lane description';
        const position = 2;
        const result = await addLane(plannerId, title, description, position);
        expect(result).toBeDefined();
        const call = (global.fetch as jest.Mock).mock.calls[0];
        const body = JSON.parse(call[1].body);
        expect(body.color).toBeUndefined();
      });

      it('creates mock lane for temporary planner', async () => {
        const plannerId = 'temp-123';
        global.fetch = jest.fn().mockResolvedValue({
          ok: false,
          status: 500,
          text: () => Promise.resolve('Backend error'),
        });

        const result = await addLane(plannerId, 'Temp Lane', 'Desc', 0);
        expect(result.id).toMatch(/^temp-lane-/);
        expect(result.planner_id).toBe(plannerId);
        expect(result.title).toBe('Temp Lane');
      });

      it('throws error for non-temporary planner when backend fails', async () => {
        const plannerId = 'planner-1';
        global.fetch = jest.fn().mockResolvedValue({
          ok: false,
          status: 500,
          text: () => Promise.resolve('Backend error'),
        });

        await expect(addLane(plannerId, 'Lane', 'Desc', 0)).rejects.toThrow('Backend error');
      });
    });

    describe('updateLane', () => {
      it('updates a lane successfully', async () => {
        const plannerId = 'planner-1';
        const laneId = 'lane-1';
        const title = 'Updated Lane';
        const description = 'Updated description';
        const color = '#00FF00';
        const result = await updateLane(plannerId, laneId, title, description, color);
        expect(result).toBeDefined();
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining(`/planner/${plannerId}/lane/${laneId}`),
          expect.objectContaining({
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, description, color }),
          })
        );
      });

      it('creates mock updated lane for temporary planner', async () => {
        const plannerId = 'temp-123';
        const laneId = 'temp-lane-456';
        global.fetch = jest.fn().mockResolvedValue({
          ok: false,
          status: 500,
          text: () => Promise.resolve('Backend error'),
        });

        const result = await updateLane(plannerId, laneId, 'Updated', 'Desc', '#FF0000');
        expect(result.id).toBe(laneId);
        expect(result.planner_id).toBe(plannerId);
        expect(result.title).toBe('Updated');
      });
    });

    describe('deleteLane', () => {
      it('deletes a lane successfully', async () => {
        const plannerId = 'planner-1';
        const laneId = 'lane-1';
        await deleteLane(plannerId, laneId);
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining(`/planner/${plannerId}/lane/${laneId}`),
          expect.objectContaining({
            method: 'DELETE',
          })
        );
      });

      it('throws error when delete fails', async () => {
        global.fetch = jest.fn().mockResolvedValue({
          ok: false,
          status: 404,
          text: () => Promise.resolve('Lane not found'),
        });

        await expect(deleteLane('planner-1', 'nonexistent')).rejects.toThrow('Lane not found');
      });
    });

    describe('splitLane', () => {
      it('splits a lane successfully', async () => {
        const plannerId = 'planner-1';
        const laneId = 'lane-1';
        const newTitle = 'Split Lane';
        const newDescription = 'Split description';
        const splitPosition = 1;
        const newColor = '#FF00FF';
        const result = await splitLane(plannerId, laneId, newTitle, newDescription, splitPosition, newColor);
        expect(result).toBeDefined();
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining(`/planner/${plannerId}/lane/${laneId}/split`),
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          })
        );
      });

      it('creates mock split lane for temporary planner', async () => {
        const plannerId = 'temp-123';
        const laneId = 'temp-lane-456';
        global.fetch = jest.fn().mockResolvedValue({
          ok: false,
          status: 500,
          text: () => Promise.resolve('Backend error'),
        });

        const result = await splitLane(plannerId, laneId, 'Split', 'Desc', 0, '#FF0000');
        expect(result.id).toMatch(/^temp-lane-/);
        expect(result.planner_id).toBe(plannerId);
        expect(result.title).toBe('Split');
      });
    });

    describe('reorderLanes', () => {
      it('reorders lanes successfully', async () => {
        const plannerId = 'planner-1';
        const laneIds = ['lane-1', 'lane-2', 'lane-3'];
        await reorderLanes(plannerId, laneIds);
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining(`/planner/${plannerId}/lanes/reorder`),
          expect.objectContaining({
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lane_ids: laneIds }),
          })
        );
      });

      it('throws error when reorder fails', async () => {
        global.fetch = jest.fn().mockResolvedValue({
          ok: false,
          status: 500,
          text: () => Promise.resolve('Reorder failed'),
        });

        await expect(reorderLanes('planner-1', [])).rejects.toThrow('Reorder failed');
      });
    });
  });

  describe('Card API', () => {
    describe('getCard', () => {
      it('fetches a card successfully', async () => {
        const cardId = 'card-1';
        const result = await getCard(cardId);
        expect(result).toBeDefined();
        const calls = (global.fetch as jest.Mock).mock.calls;
        expect(calls[0][0]).toContain(`/planner/card/${cardId}`);
      });

      it('throws error when card not found', async () => {
        global.fetch = jest.fn().mockResolvedValue({
          ok: false,
          status: 404,
          text: () => Promise.resolve('Card not found'),
        });

        await expect(getCard('nonexistent')).rejects.toThrow('Card not found');
      });
    });

    describe('addCard', () => {
      it('adds a card successfully', async () => {
        const plannerId = 'planner-1';
        const laneId = 'lane-1';
        const title = 'New Card';
        const content = 'Card content';
        const position = 0;
        const result = await addCard(plannerId, laneId, title, content, position);
        expect(result).toBeDefined();
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining(`/planner/${plannerId}/lane/${laneId}/card`),
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content, position }),
          })
        );
      });

      it('creates mock card for temporary planner', async () => {
        const plannerId = 'temp-123';
        const laneId = 'temp-lane-456';
        global.fetch = jest.fn().mockResolvedValue({
          ok: false,
          status: 500,
          text: () => Promise.resolve('Backend error'),
        });

        const result = await addCard(plannerId, laneId, 'Card', 'Content', 0);
        expect(result.id).toMatch(/^temp-card-/);
        expect(result.lane_id).toBe(laneId);
        expect(result.fields).toEqual({ title: 'Card', content: 'Content' });
      });
    });

    describe('updateCard', () => {
      it('updates a card successfully', async () => {
        const plannerId = 'planner-1';
        const laneId = 'lane-1';
        const cardId = 'card-1';
        const title = 'Updated Card';
        const content = 'Updated content';
        const result = await updateCard(plannerId, laneId, cardId, title, content);
        expect(result).toBeDefined();
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining(`/planner/${plannerId}/lane/${laneId}/card/${cardId}`),
          expect.objectContaining({
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, content }),
          })
        );
      });

      it('creates mock updated card for temporary planner', async () => {
        const plannerId = 'temp-123';
        const laneId = 'temp-lane-456';
        const cardId = 'temp-card-789';
        global.fetch = jest.fn().mockResolvedValue({
          ok: false,
          status: 500,
          text: () => Promise.resolve('Backend error'),
        });

        const result = await updateCard(plannerId, laneId, cardId, 'Updated', 'Content');
        expect(result.id).toBe(cardId);
        expect(result.lane_id).toBe(laneId);
        expect(result.title).toBe('Updated');
      });
    });

    describe('deleteCard', () => {
      it('deletes a card successfully', async () => {
        const plannerId = 'planner-1';
        const laneId = 'lane-1';
        const cardId = 'card-1';
        await deleteCard(plannerId, laneId, cardId);
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining(`/planner/${plannerId}/lane/${laneId}/card/${cardId}`),
          expect.objectContaining({
            method: 'DELETE',
          })
        );
      });

      it('mock delete for temporary planner does not throw', async () => {
        const plannerId = 'temp-123';
        const laneId = 'temp-lane-456';
        const cardId = 'temp-card-789';
        global.fetch = jest.fn().mockResolvedValue({
          ok: false,
          status: 500,
          text: () => Promise.resolve('Backend error'),
        });

        await expect(deleteCard(plannerId, laneId, cardId)).resolves.not.toThrow();
      });

      it('throws error for non-temporary planner when delete fails', async () => {
        const plannerId = 'planner-1';
        const laneId = 'lane-1';
        const cardId = 'card-1';
        global.fetch = jest.fn().mockResolvedValue({
          ok: false,
          status: 404,
          text: () => Promise.resolve('Card not found'),
        });

        await expect(deleteCard(plannerId, laneId, cardId)).rejects.toThrow('Card not found');
      });
    });

    describe('reorderCards', () => {
      it('reorders cards successfully', async () => {
        const plannerId = 'planner-1';
        const laneId = 'lane-1';
        const cardIds = ['card-1', 'card-2', 'card-3'];
        await reorderCards(plannerId, laneId, cardIds);
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining(`/planner/${plannerId}/lane/${laneId}/cards/reorder`),
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ card_ids: cardIds }),
          })
        );
      });

      it('mock reorder for temporary planner does not throw', async () => {
        const plannerId = 'temp-123';
        const laneId = 'temp-lane-456';
        global.fetch = jest.fn().mockResolvedValue({
          ok: false,
          status: 500,
          text: () => Promise.resolve('Backend error'),
        });

        await expect(reorderCards(plannerId, laneId, [])).resolves.not.toThrow();
      });
    });

    describe('moveCard', () => {
      it('moves a card successfully', async () => {
        const plannerId = 'planner-1';
        const cardId = 'card-1';
        const newLaneId = 'lane-2';
        const newPosition = 0;
        const result = await moveCard(plannerId, cardId, newLaneId, newPosition);
        expect(result).toBeDefined();
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining(`/planner/${plannerId}/card/${cardId}/move`),
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ new_lane_id: newLaneId, new_position: newPosition }),
          })
        );
      });

      it('creates mock moved card for temporary planner', async () => {
        const plannerId = 'temp-123';
        const cardId = 'temp-card-456';
        const newLaneId = 'temp-lane-789';
        global.fetch = jest.fn().mockResolvedValue({
          ok: false,
          status: 500,
          text: () => Promise.resolve('Backend error'),
        });

        const result = await moveCard(plannerId, cardId, newLaneId, 0);
        expect(result.id).toBe(cardId);
        expect(result.lane_id).toBe(newLaneId);
      });
    });
  });

  describe('Markdown import/export', () => {
    describe('exportPlannerMarkdown', () => {
      it('exports planner markdown successfully', async () => {
        const plannerId = 'planner-1';
        const result = await exportPlannerMarkdown(plannerId);
        expect(typeof result).toBe('string');
        const calls = (global.fetch as jest.Mock).mock.calls;
        expect(calls[0][0]).toContain(`/planner/${plannerId}/export`);
      });

      it('throws error when export fails', async () => {
        global.fetch = jest.fn().mockResolvedValue({
          ok: false,
          status: 500,
          text: () => Promise.resolve('Export failed'),
        });

        await expect(exportPlannerMarkdown('planner-1')).rejects.toThrow('Export failed');
      });
    });

    describe('importPlannerFromMarkdown', () => {
      it('imports planner from markdown successfully', async () => {
        const markdown = '# Title\nContent';
        const templateId = 'template-1';
        const result = await importPlannerFromMarkdown(markdown, templateId);
        expect(result).toBeDefined();
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/planner/import'),
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ markdown, template_id: templateId }),
          })
        );
      });

      it('throws error when import fails', async () => {
        global.fetch = jest.fn().mockResolvedValue({
          ok: false,
          status: 400,
          text: () => Promise.resolve('Invalid markdown'),
        });

        await expect(importPlannerFromMarkdown('invalid', 'template-1')).rejects.toThrow('Invalid markdown');
      });
    });
  });

  describe('Error handling', () => {
    it('propagates error messages from response text', async () => {
      const errorMessage = 'Custom validation error';
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve(errorMessage),
      });

      await expect(getPlanner('planner-1')).rejects.toThrow(errorMessage);
    });

    it('handles non-JSON error responses', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 502,
        text: () => Promise.resolve('<html>Bad Gateway</html>'),
      });

      await expect(getPlanner('planner-1')).rejects.toThrow('<html>Bad Gateway</html>');
    });
  });
});
