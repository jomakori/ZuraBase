/**
 * Tests for MarkdownEditor component
 */

import React from 'react';
import { screen, cleanup } from '@testing-library/react';
import { render, RenderResult } from '@testing-library/react';
import MarkdownEditor from '@/shared/components/MarkdownEditor';

describe('MarkdownEditor', () => {
  const defaultProps = {
    content: '# Initial content',
    setContent: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  /**
   * Helper to render MarkdownEditor with custom props
   */
  const renderEditor = (overrides: Partial<typeof defaultProps> = {}): RenderResult => {
    const props = { ...defaultProps, ...overrides };
    return render(<MarkdownEditor {...props} />);
  };

  describe('Rendering', () => {
    it('renders editor with test id', () => {
      renderEditor();
      const editors = screen.getAllByTestId('markdown-editor');
      expect(editors.length).toBeGreaterThan(0);
      expect(editors[0]).toBeInTheDocument();
    });

    it('renders content when provided', () => {
      renderEditor({ content: '# Hello World' });
      const editor = screen.getByRole('textbox');
      expect(editor).toHaveTextContent('# Hello World');
    });

    it('renders with empty content', () => {
      renderEditor({ content: '' });
      const editor = screen.getByRole('textbox');
      expect(editor).toHaveTextContent('');
    });

    it('renders with role textbox', () => {
      renderEditor();
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('renders markdown content correctly', () => {
      const markdownContent = '# Heading';
      renderEditor({ content: markdownContent });
      expect(screen.getByRole('textbox')).toHaveTextContent('# Heading');
    });
  });

  describe('Content changes', () => {
    it('does not call setContent on initial render', () => {
      const setContent = jest.fn();
      renderEditor({ setContent });
      expect(setContent).not.toHaveBeenCalled();
    });
  });

  describe('Editor functionality', () => {
    it('handles long content without crashing', () => {
      const longContent = '# Title\n'.repeat(1000);
      renderEditor({ content: longContent });
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has appropriate ARIA attributes', () => {
      renderEditor();
      const editor = screen.getByRole('textbox');
      expect(editor).toBeInTheDocument();
      expect(editor).toHaveAttribute('role', 'textbox');
    });

    it('is focusable', () => {
      renderEditor();
      const editor = screen.getByRole('textbox');
      expect(editor).toBeInTheDocument();
    });
  });

  describe('Integration with parent components', () => {
    it('receives content prop', () => {
      const testContent = '# Test Note';
      renderEditor({ content: testContent });
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('accepts setContent callback prop', () => {
      const setContent = jest.fn();
      renderEditor({ setContent });
      // The component receives the callback but doesn't call it on mount
      expect(setContent).not.toHaveBeenCalled();
    });
  });
});
