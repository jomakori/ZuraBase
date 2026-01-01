/**
 * Shared mock data for all frontend tests
 */

// User data
export const mockUser = {
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  avatar_url: 'https://example.com/avatar.jpg',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
};

// Auth tokens
export const mockAuthTokens = {
  access_token: 'mock-access-token',
  refresh_token: 'mock-refresh-token',
  expires_in: 3600,
  token_type: 'Bearer',
};

// LLM Profiles
export const mockLLMProfiles = [
  {
    id: 'llm-1',
    user_id: 'user-123',
    name: 'OpenAI Default',
    server_url: '',
    api_key: 'sk-mock-key',
    is_default: true,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'llm-2',
    user_id: 'user-123',
    name: 'Custom Server',
    server_url: 'https://api.custom-llm.com',
    api_key: 'custom-key',
    is_default: false,
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
  },
];

// Notes
export const mockNotes = [
  {
    id: 'note-1',
    user_id: 'user-123',
    title: 'Test Note 1',
    content: '# Test Content\n\nThis is a test note.',
    text: '# Test Content\n\nThis is a test note.',
    cover_image: null,
    cover_url: '',
    is_public: false,
    created_at: '2024-01-01T10:00:00Z',
    updated_at: '2024-01-01T10:00:00Z',
  },
  {
    id: 'note-2',
    user_id: 'user-123',
    title: 'Test Note 2',
    content: 'Another test note',
    text: 'Another test note',
    cover_image: 'https://example.com/cover.jpg',
    cover_url: 'https://example.com/cover.jpg',
    is_public: true,
    created_at: '2024-01-02T11:00:00Z',
    updated_at: '2024-01-02T11:00:00Z',
  },
];

// Planner data
export const mockPlanner = {
  id: 'planner-1',
  user_id: 'user-123',
  title: 'My Planner',
  description: 'Test planner',
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  lanes: [
    {
      id: 'lane-1',
      planner_id: 'planner-1',
      title: 'Backlog',
      position: 0,
      cards: [
        {
          id: 'card-1',
          lane_id: 'lane-1',
          title: 'Card 1',
          description: 'First card',
          position: 0,
          created_at: '2024-01-01T12:00:00Z',
          updated_at: '2024-01-01T12:00:00Z',
        },
        {
          id: 'card-2',
          lane_id: 'lane-1',
          title: 'Card 2',
          description: 'Second card',
          position: 1,
          created_at: '2024-01-01T13:00:00Z',
          updated_at: '2024-01-01T13:00:00Z',
        },
      ],
    },
    {
      id: 'lane-2',
      planner_id: 'planner-1',
      title: 'In Progress',
      position: 1,
      cards: [
        {
          id: 'card-3',
          lane_id: 'lane-2',
          title: 'Card 3',
          description: 'Third card',
          position: 0,
          created_at: '2024-01-01T14:00:00Z',
          updated_at: '2024-01-01T14:00:00Z',
        },
      ],
    },
  ],
};

// Strands
export const mockStrands = [
  {
    id: 'strand-1',
    user_id: 'user-123',
    title: 'Test Strand',
    content: 'Strand content',
    tags: ['tag1', 'tag2'],
    source: 'manual',
    metadata: {},
    created_at: '2024-01-01T09:00:00Z',
    updated_at: '2024-01-01T09:00:00Z',
    attachments: [],
  },
  {
    id: 'strand-2',
    user_id: 'user-123',
    title: 'Another Strand',
    content: 'More content',
    tags: ['tag3'],
    source: 'whatsapp',
    metadata: { phone_number: '+1234567890' },
    created_at: '2024-01-02T10:00:00Z',
    updated_at: '2024-01-02T10:00:00Z',
    attachments: [
      {
        id: 'att-1',
        strand_id: 'strand-2',
        file_name: 'document.pdf',
        file_url: 'https://example.com/doc.pdf',
        file_type: 'pdf',
        file_size: 1024,
        created_at: '2024-01-02T10:05:00Z',
      },
    ],
  },
];

// Sync logs
export const mockSyncLogs = [
  {
    id: 'log-1',
    user_id: 'user-123',
    service: 'whatsapp',
    status: 'success',
    items_synced: 5,
    started_at: '2024-01-01T08:00:00Z',
    completed_at: '2024-01-01T08:05:00Z',
    error_message: null,
  },
  {
    id: 'log-2',
    user_id: 'user-123',
    service: 'whatsapp',
    status: 'failed',
    items_synced: 0,
    started_at: '2024-01-02T09:00:00Z',
    completed_at: '2024-01-02T09:01:00Z',
    error_message: 'Connection timeout',
  },
];

// API responses
export const mockApiResponses = {
  success: (data: any) => ({
    success: true,
    data,
    error: null,
  }),
  error: (message: string, code = 'ERROR') => ({
    success: false,
    data: null,
    error: {
      code,
      message,
    },
  }),
};

// Test utilities
export const mockFile = (name: string, type: string, size: number): File => {
  const blob = new Blob(['test content'], { type });
  const file = new File([blob], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
};

// Mock event handlers
export const mockEventHandlers = {
  click: jest.fn(),
  change: jest.fn(),
  submit: jest.fn(),
  keyDown: jest.fn(),
};

// Mock router
export const mockRouter = {
  push: jest.fn(),
  replace: jest.fn(),
  back: jest.fn(),
  pathname: '/',
  query: {},
};

// Mock window dimensions
export const mockWindowDimensions = {
  innerWidth: 1024,
  innerHeight: 768,
  outerWidth: 1024,
  outerHeight: 768,
};

export default {
  mockUser,
  mockAuthTokens,
  mockLLMProfiles,
  mockNotes,
  mockPlanner,
  mockStrands,
  mockSyncLogs,
  mockApiResponses,
  mockFile,
  mockEventHandlers,
  mockRouter,
  mockWindowDimensions,
};
