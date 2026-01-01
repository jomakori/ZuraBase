/**
 * Data factories for generating test data
 */

import { mockUser, mockNotes, mockLLMProfiles, mockPlanner, mockStrands } from './mockData';

// Simple deterministic ID generator
let idCounter = 0;
const generateId = (prefix = 'item') => `${prefix}-${++idCounter}`;
const generateUuid = () => `uuid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Reset counter for deterministic tests
export const resetIdCounter = () => { idCounter = 0; };

// User factory
export const userFactory = (overrides: any = {}) => ({
  id: generateUuid(),
  email: `user${idCounter}@example.com`,
  name: `User ${idCounter}`,
  avatar_url: `https://example.com/avatar/${idCounter}.jpg`,
  created_at: new Date(Date.now() - 1000000000).toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

// LLM Profile factory
export const llmProfileFactory = (overrides: any = {}) => ({
  id: generateUuid(),
  user_id: 'user-123',
  name: `LLM Profile ${idCounter}`,
  server_url: `https://api.llm${idCounter}.com`,
  api_key: `sk-${generateId('key')}`,
  is_default: idCounter === 1, // First one is default
  created_at: new Date(Date.now() - 800000000).toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

// Note factory
export const noteFactory = (overrides: any = {}) => ({
  id: generateUuid(),
  user_id: 'user-123',
  title: `Note Title ${idCounter}`,
  content: `Content for note ${idCounter}. This is some sample content.`,
  cover_image: idCounter % 3 === 0 ? `https://example.com/cover/${idCounter}.jpg` : null,
  is_public: idCounter % 2 === 0,
  created_at: new Date(Date.now() - 600000000).toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

// Planner factory
export const plannerFactory = (overrides: any = {}) => ({
  id: generateUuid(),
  user_id: 'user-123',
  title: `Planner ${idCounter}`,
  description: `Description for planner ${idCounter}`,
  created_at: new Date(Date.now() - 500000000).toISOString(),
  updated_at: new Date().toISOString(),
  lanes: [],
  ...overrides,
});

// Lane factory
export const laneFactory = (overrides: any = {}) => ({
  id: generateUuid(),
  planner_id: 'planner-1',
  title: `Lane ${idCounter}`,
  position: idCounter,
  cards: [],
  created_at: new Date(Date.now() - 400000000).toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

// Card factory
export const cardFactory = (overrides: any = {}) => ({
  id: generateUuid(),
  lane_id: 'lane-1',
  title: `Card ${idCounter}`,
  description: `Description for card ${idCounter}`,
  position: idCounter,
  created_at: new Date(Date.now() - 300000000).toISOString(),
  updated_at: new Date().toISOString(),
  ...overrides,
});

// Strand factory
export const strandFactory = (overrides: any = {}) => ({
  id: generateUuid(),
  user_id: 'user-123',
  title: `Strand ${idCounter}`,
  content: `Content for strand ${idCounter}. This is some sample content.`,
  tags: ['tag1', 'tag2'].slice(0, (idCounter % 2) + 1),
  source: ['manual', 'whatsapp', 'email', 'web'][idCounter % 4],
  metadata: {},
  created_at: new Date(Date.now() - 200000000).toISOString(),
  updated_at: new Date().toISOString(),
  attachments: [],
  ...overrides,
});

// Attachment factory
export const attachmentFactory = (overrides: any = {}) => ({
  id: generateUuid(),
  strand_id: 'strand-1',
  file_name: `file${idCounter}.pdf`,
  file_url: `https://example.com/files/${idCounter}.pdf`,
  file_type: 'pdf',
  file_size: 1024 * (idCounter + 1),
  created_at: new Date(Date.now() - 100000000).toISOString(),
  ...overrides,
});

// Sync log factory
export const syncLogFactory = (overrides: any = {}) => ({
  id: generateUuid(),
  user_id: 'user-123',
  service: ['whatsapp', 'email', 'web'][idCounter % 3],
  status: ['success', 'failed', 'partial'][idCounter % 3],
  items_synced: idCounter * 5,
  started_at: new Date(Date.now() - 900000000).toISOString(),
  completed_at: new Date(Date.now() - 800000000).toISOString(),
  error_message: idCounter % 3 === 1 ? `Error ${idCounter}: Something went wrong` : null,
  ...overrides,
});

// API response factory
export const apiResponseFactory = (data: any, overrides: any = {}) => ({
  success: true,
  data,
  error: null,
  ...overrides,
});

// API error factory
export const apiErrorFactory = (message = 'An error occurred', code = 'ERROR', overrides: any = {}) => ({
  success: false,
  data: null,
  error: {
    code,
    message,
  },
  ...overrides,
});

// Generate multiple items
export const generateMany = <T>(factory: (overrides?: any) => T, count: number, overrides?: any): T[] => {
  const items: T[] = [];
  for (let i = 0; i < count; i++) {
    items.push(factory({ ...overrides }));
  }
  return items;
};

// Build complex planner with lanes and cards
export const buildPlannerWithLanes = (laneCount = 3, cardsPerLane = 2) => {
  const planner = plannerFactory();
  const lanes = [];
  
  for (let i = 0; i < laneCount; i++) {
    const lane = laneFactory({ planner_id: planner.id, position: i });
    const cards = [];
    
    for (let j = 0; j < cardsPerLane; j++) {
      cards.push(cardFactory({ lane_id: lane.id, position: j }));
    }
    
    lane.cards = cards;
    lanes.push(lane);
  }
  
  planner.lanes = lanes;
  return planner;
};

// Build strand with attachments
export const buildStrandWithAttachments = (attachmentCount = 2) => {
  const strand = strandFactory();
  const attachments = generateMany(attachmentFactory, attachmentCount, { strand_id: strand.id });
  strand.attachments = attachments;
  return strand;
};

// Mock file factory
export const mockFileFactory = (overrides: any = {}) => {
  const name = overrides.name || `file${idCounter}.txt`;
  const type = overrides.type || 'text/plain';
  const size = overrides.size || 1024;
  
  const blob = new Blob(['test content'], { type });
  const file = new File([blob], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  
  return file;
};

// Export all factories
export default {
  resetIdCounter,
  userFactory,
  llmProfileFactory,
  noteFactory,
  plannerFactory,
  laneFactory,
  cardFactory,
  strandFactory,
  attachmentFactory,
  syncLogFactory,
  apiResponseFactory,
  apiErrorFactory,
  generateMany,
  buildPlannerWithLanes,
  buildStrandWithAttachments,
  mockFileFactory,
};
