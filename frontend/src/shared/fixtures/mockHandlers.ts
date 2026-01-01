/**
 * Mock API handlers for testing
 * Uses fetch mocking for API requests
 */

import { mockUser, mockNotes, mockLLMProfiles, mockPlanner, mockStrands, mockSyncLogs } from './mockData';

// Helper to create mock response
const createResponse = (data: any, status = 200) => {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    headers: new Headers({ 'Content-Type': 'application/json' }),
  } as Response);
};

// Helper to create empty response (no body)
const createEmptyResponse = (status = 204) => {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.reject(new Error('No content')),
    text: () => Promise.resolve(''),
    headers: new Headers(),
  } as Response);
};

// Helper to create error response
const createErrorResponse = (message: string, status = 500) => {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve({ error: { message } }),
    text: () => Promise.resolve(JSON.stringify({ error: { message } })),
    headers: new Headers({ 'Content-Type': 'application/json' }),
  } as Response);
};

// Auth handlers
export const authHandlers = {
  login: () => createResponse({
    user: mockUser,
    tokens: {
      access_token: 'mock-access-token',
      refresh_token: 'mock-refresh-token',
      expires_in: 3600,
    },
  }),
  logout: () => createResponse({ success: true }),
  refresh: () => createResponse({
    access_token: 'new-access-token',
    refresh_token: 'mock-refresh-token',
    expires_in: 3600,
  }),
  me: () => createResponse({ user: mockUser }),
  user: () => createResponse(mockUser),
};

// LLM Profiles handlers
export const llmProfilesHandlers = {
  getProfiles: () => createResponse({ profiles: mockLLMProfiles }),
  createProfile: (profile: any) => createResponse({
    profile: {
      id: 'new-profile-id',
      user_id: mockUser.id,
      ...profile,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  }),
  updateProfile: (id: string, updates: any) => createResponse({
    profile: {
      ...mockLLMProfiles.find(p => p.id === id),
      ...updates,
      updated_at: new Date().toISOString(),
    },
  }),
  deleteProfile: () => createResponse({ success: true }),
  setDefaultProfile: (id: string) => createResponse({
    profile: {
      ...mockLLMProfiles.find(p => p.id === id),
      is_default: true,
      updated_at: new Date().toISOString(),
    },
  }),
  testConnection: () => createResponse({
    success: true,
    message: 'Connection successful',
  }),
};

// Notes handlers
export const notesHandlers = {
  getNotes: () => createResponse(mockNotes), // returns array directly
  getNote: (id: string) => {
    const note = mockNotes.find(n => n.id === id);
    return note ? createResponse(note) : createErrorResponse('Note not found', 404);
  },
  createNote: (note: any) => createResponse({
    id: 'new-note-id',
    user_id: mockUser.id,
    ...note,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }),
  updateNote: (id: string, updates: any) => createResponse({
    ...mockNotes.find(n => n.id === id),
    ...updates,
    updated_at: new Date().toISOString(),
  }),
  deleteNote: () => createEmptyResponse(204),
};

// Planner handlers
export const plannerHandlers = {
  getTemplates: () => createResponse([
    { id: 'template-1', name: 'Scrum Board', type: 'scrum', lanes: [] },
    { id: 'template-2', name: 'Kanban Board', type: 'kanban', lanes: [] },
  ]),
  getTemplate: (id: string) => createResponse({
    id,
    name: 'Test Template',
    type: 'scrum',
    lanes: [],
  }),
  initializeTemplates: () => createResponse({ success: true }),
  getPlanner: (id: string) => createResponse(mockPlanner),
  createPlanner: (planner: any) => createResponse({
    id: 'new-planner-id',
    user_id: mockUser.id,
    ...planner,
    lanes: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }),
  updatePlanner: (id: string, updates: any) => createResponse({
    ...mockPlanner,
    ...updates,
    updated_at: new Date().toISOString(),
  }),
  deletePlanner: () => createEmptyResponse(204),
  createLane: (plannerId: string, lane: any) => createResponse({
    id: 'new-lane-id',
    planner_id: plannerId,
    ...lane,
    cards: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }),
  updateLane: (laneId: string, updates: any) => createResponse({
    ...mockPlanner.lanes.find(l => l.id === laneId),
    ...updates,
    updated_at: new Date().toISOString(),
  }),
  deleteLane: () => createEmptyResponse(204),
  splitLane: () => createResponse({
    id: 'split-lane-id',
    planner_id: 'planner-1',
    title: 'Split Lane',
    description: 'Split description',
    position: 1,
    cards: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }),
  getCard: (cardId: string) => createResponse({
    id: cardId,
    lane_id: 'lane-1',
    fields: { title: 'Test Card', content: 'Test content' },
    position: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }),
  createCard: (laneId: string, card: any) => createResponse({
    id: 'new-card-id',
    lane_id: laneId,
    ...card,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }),
  updateCard: (cardId: string, updates: any) => createResponse({
    ...mockPlanner.lanes.flatMap(l => l.cards).find(c => c.id === cardId),
    ...updates,
    updated_at: new Date().toISOString(),
  }),
  deleteCard: () => createEmptyResponse(204),
  reorderLanes: () => createEmptyResponse(204),
  reorderCards: () => createEmptyResponse(204),
  moveCard: (cardId: string, updates: any) => createResponse({
    id: cardId,
    lane_id: updates?.new_lane_id || 'lane-2',
    fields: { title: 'Moved Card', content: '' },
    position: updates?.new_position || 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }),
  exportMarkdown: () => createResponse('# Planner Export\n\nMarkdown content'),
  importMarkdown: (data: any) => createResponse({
    id: 'imported-planner-id',
    user_id: mockUser.id,
    ...data,
    lanes: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }),
};

// Strands handlers
export const strandsHandlers = {
  getStrands: () => createResponse({ strands: mockStrands }),
  getStrand: (id: string) => {
    const strand = mockStrands.find(s => s.id === id);
    return strand ? createResponse({ strand }) : createErrorResponse('Strand not found', 404);
  },
  createStrand: (strand: any) => createResponse({
    strand: {
      id: 'new-strand-id',
      user_id: mockUser.id,
      ...strand,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  }),
  updateStrand: (id: string, updates: any) => createResponse({
    strand: {
      ...mockStrands.find(s => s.id === id),
      ...updates,
      updated_at: new Date().toISOString(),
    },
  }),
  deleteStrand: () => createResponse({ success: true }),
  syncStrands: () => createResponse({
    success: true,
    logs: mockSyncLogs,
  }),
  getSyncLogs: () => createResponse({ logs: mockSyncLogs }),
  uploadAttachment: () => createResponse({
    attachment: {
      id: 'new-attachment-id',
      strand_id: 'strand-1',
      file_name: 'uploaded.pdf',
      file_url: 'https://example.com/uploaded.pdf',
      file_type: 'pdf',
      file_size: 2048,
      created_at: new Date().toISOString(),
    },
  }),
  deleteAttachment: () => createResponse({ success: true }),
};

// Combined handlers for fetch mocking
export const setupMockHandlers = () => {
  const handlers: Record<string, any> = {};

  // Map URL patterns to handlers
  const urlHandlers = [
    // Auth
    { pattern: /\/api\/auth\/login$/, method: 'POST', handler: authHandlers.login },
    { pattern: /\/api\/auth\/logout$/, method: 'POST', handler: authHandlers.logout },
    { pattern: /\/api\/auth\/refresh$/, method: 'POST', handler: authHandlers.refresh },
    { pattern: /\/api\/auth\/me$/, method: 'GET', handler: authHandlers.me },
    { pattern: /\/auth\/user$/, method: 'GET', handler: authHandlers.user },
    
    // LLM Profiles
    { pattern: /\/api\/llm-profiles$/, method: 'GET', handler: llmProfilesHandlers.getProfiles },
    { pattern: /\/api\/llm-profiles$/, method: 'POST', handler: llmProfilesHandlers.createProfile },
    { pattern: /\/api\/llm-profiles\/[^/]+$/, method: 'PUT', handler: llmProfilesHandlers.updateProfile },
    { pattern: /\/api\/llm-profiles\/[^/]+$/, method: 'DELETE', handler: llmProfilesHandlers.deleteProfile },
    { pattern: /\/api\/llm-profiles\/[^/]+\/default$/, method: 'POST', handler: llmProfilesHandlers.setDefaultProfile },
    { pattern: /\/api\/llm-profiles\/test-connection$/, method: 'POST', handler: llmProfilesHandlers.testConnection },
    
    // Notes (plural for some endpoints, singular for others)
    { pattern: /\/api\/notes$/, method: 'GET', handler: notesHandlers.getNotes },
    { pattern: /\/api\/notes$/, method: 'POST', handler: notesHandlers.createNote },
    { pattern: /\/api\/notes\/[^/]+$/, method: 'GET', handler: notesHandlers.getNote },
    { pattern: /\/api\/notes\/[^/]+$/, method: 'PUT', handler: notesHandlers.updateNote },
    { pattern: /\/api\/notes\/[^/]+$/, method: 'DELETE', handler: notesHandlers.deleteNote },
    // Singular note endpoints (used by notes.api.ts)
    { pattern: /\/api\/note$/, method: 'POST', handler: notesHandlers.createNote },
    { pattern: /\/api\/note\/[^/]+$/, method: 'GET', handler: notesHandlers.getNote },
    { pattern: /\/api\/note\/[^/]+$/, method: 'DELETE', handler: notesHandlers.deleteNote },
    // Also support /note (without /api) for compatibility
    { pattern: /\/note$/, method: 'POST', handler: notesHandlers.createNote },
    { pattern: /\/note\/[^/]+$/, method: 'GET', handler: notesHandlers.getNote },
    { pattern: /\/note\/[^/]+$/, method: 'DELETE', handler: notesHandlers.deleteNote },
    
    // Planner Templates
    { pattern: /\/planner\/templates$/, method: 'GET', handler: plannerHandlers.getTemplates },
    { pattern: /\/planner\/templates\/[^/]+$/, method: 'GET', handler: plannerHandlers.getTemplate },
    { pattern: /\/planner\/templates\/init$/, method: 'POST', handler: plannerHandlers.initializeTemplates },
    
    // Planner CRUD
    { pattern: /\/planner\/[^/]+$/, method: 'GET', handler: plannerHandlers.getPlanner },
    { pattern: /\/planner$/, method: 'POST', handler: plannerHandlers.createPlanner },
    { pattern: /\/planner\/[^/]+$/, method: 'PUT', handler: plannerHandlers.updatePlanner },
    { pattern: /\/planner\/[^/]+$/, method: 'DELETE', handler: plannerHandlers.deletePlanner },
    
    // Planner Lanes
    { pattern: /\/planner\/[^/]+\/lane$/, method: 'POST', handler: plannerHandlers.createLane },
    { pattern: /\/planner\/[^/]+\/lane\/[^/]+$/, method: 'PUT', handler: plannerHandlers.updateLane },
    { pattern: /\/planner\/[^/]+\/lane\/[^/]+$/, method: 'DELETE', handler: plannerHandlers.deleteLane },
    { pattern: /\/planner\/[^/]+\/lane\/[^/]+\/split$/, method: 'POST', handler: plannerHandlers.splitLane },
    { pattern: /\/planner\/[^/]+\/lanes\/reorder$/, method: 'PUT', handler: plannerHandlers.reorderLanes },
    
    // Planner Cards
    { pattern: /\/planner\/card\/[^/]+$/, method: 'GET', handler: plannerHandlers.getCard },
    { pattern: /\/planner\/[^/]+\/lane\/[^/]+\/card$/, method: 'POST', handler: plannerHandlers.createCard },
    { pattern: /\/planner\/[^/]+\/lane\/[^/]+\/card\/[^/]+$/, method: 'PUT', handler: plannerHandlers.updateCard },
    { pattern: /\/planner\/[^/]+\/lane\/[^/]+\/card\/[^/]+$/, method: 'DELETE', handler: plannerHandlers.deleteCard },
    { pattern: /\/planner\/[^/]+\/lane\/[^/]+\/cards\/reorder$/, method: 'POST', handler: plannerHandlers.reorderCards },
    { pattern: /\/planner\/[^/]+\/card\/[^/]+\/move$/, method: 'POST', handler: plannerHandlers.moveCard },
    
    // Planner Export/Import
    { pattern: /\/planner\/[^/]+\/export$/, method: 'GET', handler: plannerHandlers.exportMarkdown },
    { pattern: /\/planner\/import$/, method: 'POST', handler: plannerHandlers.importMarkdown },
    
    // Strands
    { pattern: /\/api\/strands$/, method: 'GET', handler: strandsHandlers.getStrands },
    { pattern: /\/api\/strands$/, method: 'POST', handler: strandsHandlers.createStrand },
    { pattern: /\/api\/strands\/[^/]+$/, method: 'GET', handler: strandsHandlers.getStrand },
    { pattern: /\/api\/strands\/[^/]+$/, method: 'PUT', handler: strandsHandlers.updateStrand },
    { pattern: /\/api\/strands\/[^/]+$/, method: 'DELETE', handler: strandsHandlers.deleteStrand },
    { pattern: /\/api\/strands\/sync$/, method: 'POST', handler: strandsHandlers.syncStrands },
    { pattern: /\/api\/strands\/sync\/logs$/, method: 'GET', handler: strandsHandlers.getSyncLogs },
    { pattern: /\/api\/strands\/[^/]+\/attachments$/, method: 'POST', handler: strandsHandlers.uploadAttachment },
    { pattern: /\/api\/strands\/attachments\/[^/]+$/, method: 'DELETE', handler: strandsHandlers.deleteAttachment },
  ];

  // Create fetch mock
  global.fetch = jest.fn((url: string, options: any = {}) => {
    const method = options.method || 'GET';
    const handler = urlHandlers.find(h =>
      h.pattern.test(url) && h.method === method
    );
    
    if (handler) {
      // Parse request body if present
      let requestData;
      if (options.body) {
        try {
          requestData = JSON.parse(options.body);
        } catch {
          requestData = options.body;
        }
      }
      
      // Extract ID from URL if needed
      const match = url.match(/\/([^/]+)$/);
      const id = match ? match[1] : undefined;
      
      // Call handler with appropriate arguments using type assertion
      const handlerFn = handler.handler as any;
      // Based on handler name, decide how to call
      if (handlerFn === authHandlers.login ||
          handlerFn === authHandlers.logout ||
          handlerFn === authHandlers.refresh ||
          handlerFn === authHandlers.me ||
          handlerFn === authHandlers.user ||
          handlerFn === llmProfilesHandlers.getProfiles ||
          handlerFn === llmProfilesHandlers.deleteProfile ||
          handlerFn === llmProfilesHandlers.testConnection ||
          handlerFn === notesHandlers.getNotes ||
          handlerFn === notesHandlers.deleteNote ||
          handlerFn === plannerHandlers.getTemplates ||
          handlerFn === plannerHandlers.initializeTemplates ||
          handlerFn === plannerHandlers.deleteLane ||
          handlerFn === plannerHandlers.deleteCard ||
          handlerFn === plannerHandlers.deletePlanner ||
          handlerFn === plannerHandlers.reorderLanes ||
          handlerFn === plannerHandlers.reorderCards ||
          handlerFn === strandsHandlers.getStrands ||
          handlerFn === strandsHandlers.deleteStrand ||
          handlerFn === strandsHandlers.syncStrands ||
          handlerFn === strandsHandlers.getSyncLogs ||
          handlerFn === strandsHandlers.uploadAttachment ||
          handlerFn === strandsHandlers.deleteAttachment) {
        return handlerFn();
      } else if (handlerFn === llmProfilesHandlers.createProfile ||
                 handlerFn === notesHandlers.createNote ||
                 handlerFn === plannerHandlers.createPlanner ||
                 handlerFn === plannerHandlers.importMarkdown ||
                 handlerFn === strandsHandlers.createStrand) {
        return handlerFn(requestData);
      } else if (handlerFn === llmProfilesHandlers.updateProfile ||
                 handlerFn === llmProfilesHandlers.setDefaultProfile ||
                 handlerFn === notesHandlers.getNote ||
                 handlerFn === notesHandlers.updateNote ||
                 handlerFn === plannerHandlers.getTemplate ||
                 handlerFn === plannerHandlers.getPlanner ||
                 handlerFn === plannerHandlers.updatePlanner ||
                 handlerFn === plannerHandlers.createLane ||
                 handlerFn === plannerHandlers.updateLane ||
                 handlerFn === plannerHandlers.splitLane ||
                 handlerFn === plannerHandlers.getCard ||
                 handlerFn === plannerHandlers.createCard ||
                 handlerFn === plannerHandlers.updateCard ||
                 handlerFn === plannerHandlers.moveCard ||
                 handlerFn === plannerHandlers.exportMarkdown ||
                 handlerFn === strandsHandlers.getStrand ||
                 handlerFn === strandsHandlers.updateStrand) {
        return handlerFn(id, requestData);
      } else {
        // Fallback: call with no arguments
        return handlerFn();
      }
    }
    
    // Default 404 response
    return createErrorResponse(`No handler for ${method} ${url}`, 404);
  }) as jest.MockedFunction<typeof fetch>;

  return handlers;
};

// Cleanup function
export const cleanupMockHandlers = () => {
  if (global.fetch && (global.fetch as any).mockClear) {
    (global.fetch as jest.MockedFunction<typeof fetch>).mockClear();
  }
};

export default {
  authHandlers,
  llmProfilesHandlers,
  notesHandlers,
  plannerHandlers,
  strandsHandlers,
  setupMockHandlers,
  cleanupMockHandlers,
};
