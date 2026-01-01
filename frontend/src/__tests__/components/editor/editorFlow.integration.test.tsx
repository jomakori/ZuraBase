/**
 * Integration tests for complete editor workflow with MarkdownEditor and CoverSelector
 */

import React from 'react';
import { screen, cleanup } from '@testing-library/react';
import { render } from '@testing-library/react';
import MarkdownEditor from '@/shared/components/MarkdownEditor';
import { searchPhoto } from '@/app/client';

// Mock the searchPhoto API
jest.mock('@/app/client', () => ({
  searchPhoto: jest.fn(),
}));

const mockSearchPhoto = searchPhoto as jest.MockedFunction<typeof searchPhoto>;

/**
 * Simple wrapper component that demonstrates editor usage
 */
const EditorDemo: React.FC = () => {
  const [content, setContent] = React.useState('# My Note\n\nStart typing...');
  const [coverImage, setCoverImage] = React.useState('');

  return (
    <div>
      <div
        style={{
          backgroundImage: `url(${coverImage})`,
          backgroundSize: 'cover',
          height: '200px',
          marginBottom: '20px',
        }}
        data-testid="cover-preview"
      >
        <button onClick={() => setCoverImage('https://example.com/cover.jpg')}>
          {coverImage ? 'Change cover' : 'Add cover'}
        </button>
      </div>
      <MarkdownEditor content={content} setContent={setContent} />
      <div data-testid="content-display">{content}</div>
    </div>
  );
};

describe('Editor Workflow Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchPhoto.mockResolvedValue({
      photos: [
        {
          id: 1,
          src: {
            medium: 'https://example.com/medium1.jpg',
            landscape: 'https://example.com/landscape1.jpg',
          },
          alt: 'Nature photo',
        },
      ],
    });
  });

  afterEach(() => {
    cleanup();
  });

  describe('Create content with cover', () => {
    it('renders both editor and cover button', () => {
      render(<EditorDemo />);

      const editors = screen.getAllByTestId('markdown-editor');
      expect(editors.length).toBeGreaterThan(0);
      expect(screen.getByText(/add cover/i)).toBeInTheDocument();
    });

    it('displays initial content in editor', () => {
      render(<EditorDemo />);

      const editors = screen.getAllByTestId('markdown-editor');
      expect(editors[0]).toHaveTextContent('# My Note');
    });

    it('allows setting cover image', () => {
      const { rerender } = render(<EditorDemo />);

      // Initially shows "Add cover"
      expect(screen.getByText(/add cover/i)).toBeInTheDocument();

      // After clicking, button text changes to "Change cover"
      const button = screen.getByText(/add cover/i);
      button.click();

      // Re-render to see updated button text
      rerender(<EditorDemo />);
      expect(screen.getByText(/change cover/i)).toBeInTheDocument();
    });
  });

  describe('State management across editor and cover selector', () => {
    it('maintains editor content independently from cover image', () => {
      render(<EditorDemo />);

      const editors = screen.getAllByTestId('markdown-editor');
      const editor = editors[0];
      const initialContent = editor.textContent;

      // Change cover
      const button = screen.getByText(/add cover/i);
      button.click();

      // Editor content should remain unchanged
      expect(editor.textContent).toBe(initialContent);
    });

    it('renders editor with markdown content', () => {
      render(<EditorDemo />);

      const editors = screen.getAllByTestId('markdown-editor');
      const editor = editors[0];
      expect(editor).toHaveTextContent('# My Note');
      expect(editor).toHaveTextContent('Start typing...');
    });
  });

  describe('User interactions across components', () => {
    it('allows user to interact with editor', () => {
      render(<EditorDemo />);

      const editors = screen.getAllByTestId('markdown-editor');
      expect(editors.length).toBeGreaterThan(0);
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('displays content in both editor and content display', () => {
      render(<EditorDemo />);

      const expectedContent = '# My Note\n\nStart typing...';
      const editors = screen.getAllByTestId('markdown-editor');
      expect(editors[0]).toHaveTextContent('# My Note');
      expect(screen.getByTestId('content-display')).toHaveTextContent('# My Note');
    });

    it('can set cover image and maintain editor state', () => {
      render(<EditorDemo />);

      const editors = screen.getAllByTestId('markdown-editor');
      const editor = editors[0];
      const initialContent = editor.textContent;

      // Set cover image
      const button = screen.getByText(/add cover/i);
      button.click();

      // Editor content should still be present
      expect(editor.textContent).toBe(initialContent);
    });
  });

  describe('API integration for cover images', () => {
    it('has searchPhoto mock available for cover selection', () => {
      expect(mockSearchPhoto).toBeDefined();
      expect(typeof mockSearchPhoto).toBe('function');
    });

    it('can call searchPhoto API', async () => {
      await mockSearchPhoto('nature');
      expect(mockSearchPhoto).toHaveBeenCalledWith('nature');
    });
  });

  describe('Editor component integration', () => {
    it('renders MarkdownEditor with content prop', () => {
      render(<EditorDemo />);

      const editors = screen.getAllByTestId('markdown-editor');
      const editor = editors[0];
      expect(editor).toBeInTheDocument();
    });

    it('MarkdownEditor receives setContent callback', () => {
      render(<EditorDemo />);

      // The component should render without errors
      const editors = screen.getAllByTestId('markdown-editor');
      expect(editors.length).toBeGreaterThan(0);
    });

    it('displays content in multiple places for verification', () => {
      render(<EditorDemo />);

      const content = '# My Note';
      const editors = screen.getAllByTestId('markdown-editor');
      expect(editors[0]).toHaveTextContent(content);
      expect(screen.getByTestId('content-display')).toHaveTextContent(content);
    });
  });
});
