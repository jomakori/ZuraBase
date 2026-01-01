/**
 * Custom test utilities for React component testing
 */

import React, { ReactElement } from 'react';
import { render, RenderOptions, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '@/features/auth/context/AuthContext';
import { LLMProfilesProvider } from '@/shared/context/LLMProfilesProvider';
import { setupMockHandlers, cleanupMockHandlers } from './mockHandlers';

// Re-export testing library utilities
export { render, screen, waitFor, fireEvent };
export { userEvent };

// Custom render function that includes all providers
const AllTheProviders = ({ children }: { children: React.ReactNode }) => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LLMProfilesProvider>
          {children}
        </LLMProfilesProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

// Custom render with providers
export const renderWithProviders = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => {
  return render(ui, { wrapper: AllTheProviders, ...options });
};

// Custom render for auth-specific tests
export const renderWithAuth = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => {
  // AuthProvider doesn't accept initial state, so we rely on mock API
  // to return appropriate user data
  return renderWithProviders(ui, options);
};

// Custom render for LLM profiles tests
export const renderWithLLMProfiles = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => {
  // LLMProfilesProvider doesn't accept initial profiles, rely on mock API
  return renderWithProviders(ui, options);
};

// Setup function for tests using mock API
export const setupTest = () => {
  let user: ReturnType<typeof userEvent.setup>;
  
  beforeEach(() => {
    user = userEvent.setup();
    setupMockHandlers();
    // Clear any existing mocks
    jest.clearAllMocks();
  });
  
  afterEach(() => {
    cleanupMockHandlers();
  });
  
  return {
    get user() {
      return user;
    },
  };
};

// Helper to wait for loading to complete
export const waitForLoading = async () => {
  await waitFor(() => {
    const loadingElements = screen.queryAllByText(/loading/i);
    const skeletonElements = screen.queryAllByRole('progressbar');
    const allLoading = [...loadingElements, ...skeletonElements];
    expect(allLoading.length).toBe(0);
  });
};

// Helper to simulate drag and drop
export const simulateDragAndDrop = async (
  sourceElement: HTMLElement,
  targetElement: HTMLElement
) => {
  // Simplified drag and drop simulation
  // In real tests, you might want to use @hello-pangea/dnd's test utilities
  const dataTransfer: Record<string, string> = {};
  const mockDataTransfer = {
    data: dataTransfer,
    setData: function (type: string, val: string) {
      this.data[type] = val;
    },
    getData: function (type: string) {
      return this.data[type];
    },
  };
  
  fireEvent.dragStart(sourceElement, { dataTransfer: mockDataTransfer as any });
  fireEvent.dragEnter(targetElement, { dataTransfer: mockDataTransfer as any });
  fireEvent.dragOver(targetElement, { dataTransfer: mockDataTransfer as any });
  fireEvent.drop(targetElement, { dataTransfer: mockDataTransfer as any });
  fireEvent.dragEnd(sourceElement, { dataTransfer: mockDataTransfer as any });
};

// Helper to mock window properties
export const mockWindowProperty = (property: string, value: any) => {
  const original = (window as any)[property];
  Object.defineProperty(window, property, {
    configurable: true,
    writable: true,
    value,
  });
  
  return () => {
    (window as any)[property] = original;
  };
};

// Helper to mock matchMedia
export const mockMatchMedia = (matches = false) => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
};

// Helper to mock clipboard
export const mockClipboard = () => {
  const writeText = jest.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    writable: true,
  });
  return writeText;
};

// Helper to generate test data
export const generateTestData = {
  note: (overrides = {}) => ({
    id: `note-${Date.now()}`,
    user_id: 'user-123',
    title: 'Test Note',
    content: '# Test Content',
    cover_image: null,
    is_public: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }),
  
  strand: (overrides = {}) => ({
    id: `strand-${Date.now()}`,
    user_id: 'user-123',
    title: 'Test Strand',
    content: 'Test content',
    tags: ['test'],
    source: 'manual',
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }),
  
  planner: (overrides = {}) => ({
    id: `planner-${Date.now()}`,
    user_id: 'user-123',
    title: 'Test Planner',
    description: 'Test description',
    lanes: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  }),
};

// Custom matchers
export const toHaveTextContent = (element: HTMLElement, text: string) => {
  expect(element).toHaveTextContent(text);
};

export const toBeInTheDocument = (element: HTMLElement) => {
  expect(element).toBeInTheDocument();
};

export const toBeVisible = (element: HTMLElement) => {
  expect(element).toBeVisible();
};

export default {
  renderWithProviders,
  renderWithAuth,
  renderWithLLMProfiles,
  setupTest,
  waitForLoading,
  simulateDragAndDrop,
  mockWindowProperty,
  mockMatchMedia,
  mockClipboard,
  generateTestData,
};
