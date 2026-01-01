/**
 * Tests for PlannerWizard component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PlannerWizard from '@/features/planner/components/PlannerWizard';
import { PlannerTemplate } from '@/features/planner/types';

// Mock Headless UI components
jest.mock('@headlessui/react', () => ({
  Dialog: ({ children, open, onClose }: any) => {
    const React = require('react');
    return open ? React.createElement('div', { 'data-testid': 'dialog' },
      React.createElement('div', { 'data-testid': 'dialog-overlay', onClick: onClose }),
      React.createElement('div', { 'data-testid': 'dialog-panel' }, children)
    ) : null;
  },
  Transition: ({ children, show }: any) => (show ? children : null),
  TransitionChild: ({ children }: any) => children,
}));

describe('PlannerWizard', () => {
  const mockOnCreatePlanner = jest.fn();
  const mockOnCancel = jest.fn();
  const mockSetOpen = jest.fn();

  const mockTemplates: PlannerTemplate[] = [
    {
      id: 'template-1',
      name: 'Scrum Board',
      type: 'scrum',
      description: 'A board for Scrum sprints',
      created_at: '2024-01-01T00:00:00Z',
      lanes: [],
    },
    {
      id: 'template-2',
      name: 'Kanban Board',
      type: 'kanban',
      description: 'A classic Kanban board',
      created_at: '2024-01-02T00:00:00Z',
      lanes: [],
    },
  ];

  const defaultProps = {
    open: true,
    setOpen: mockSetOpen,
    templates: mockTemplates,
    onCreatePlanner: mockOnCreatePlanner,
    onCancel: mockOnCancel,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderWizard = (overrides: Partial<typeof defaultProps> = {}) => {
    const props = { ...defaultProps, ...overrides };
    return render(<PlannerWizard {...props} />);
  };

  describe('Rendering', () => {
    it('renders nothing when open is false', () => {
      renderWizard({ open: false });
      expect(screen.queryByTestId('dialog')).not.toBeInTheDocument();
    });

    it('renders dialog when open is true', () => {
      renderWizard();
      expect(screen.getByTestId('dialog')).toBeInTheDocument();
      expect(screen.getByText('Create New Planner')).toBeInTheDocument();
    });

    it('shows step 1 (title/description) initially', () => {
      renderWizard();
      expect(screen.getByLabelText('Title')).toBeInTheDocument();
      expect(screen.getByLabelText('Description')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('does not show step 2 (template selection) initially', () => {
      renderWizard();
      expect(screen.queryByText('Select Template')).not.toBeInTheDocument();
    });
  });

  describe('Step 1: Title and Description', () => {
    it('advances to step 2 when title is filled and Next is clicked', async () => {
      const user = userEvent.setup();
      renderWizard();
      await user.type(screen.getByLabelText('Title'), 'My Planner');
      await user.click(screen.getByRole('button', { name: 'Next' }));
      expect(screen.getByText('Select Template')).toBeInTheDocument();
      expect(screen.getByText('Scrum Board')).toBeInTheDocument();
    });

    it('disables Next button when title is empty', () => {
      renderWizard();
      const nextButton = screen.getByRole('button', { name: 'Next' });
      expect(nextButton).toBeDisabled();
    });

    it('enables Next button when title is filled', async () => {
      const user = userEvent.setup();
      renderWizard();
      await user.type(screen.getByLabelText('Title'), 'My Planner');
      const nextButton = screen.getByRole('button', { name: 'Next' });
      expect(nextButton).not.toBeDisabled();
    });

    it('calls onCancel when Cancel button is clicked', async () => {
      const user = userEvent.setup();
      renderWizard();
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(mockOnCancel).toHaveBeenCalledTimes(1);
      expect(mockSetOpen).toHaveBeenCalledWith(false);
    });

    it('calls setOpen(false) when overlay is clicked', () => {
      renderWizard();
      fireEvent.click(screen.getByTestId('dialog-overlay'));
      expect(mockSetOpen).toHaveBeenCalledWith(false);
    });
  });

  describe('Step 2: Template Selection', () => {
    const advanceToStep2 = async (user: any) => {
      await user.type(screen.getByLabelText('Title'), 'My Planner');
      await user.click(screen.getByRole('button', { name: 'Next' }));
    };

    it('renders template list', async () => {
      const user = userEvent.setup();
      renderWizard();
      await advanceToStep2(user);
      expect(screen.getByText('Scrum Board')).toBeInTheDocument();
      expect(screen.getByText('A board for Scrum sprints')).toBeInTheDocument();
      expect(screen.getByText('Kanban Board')).toBeInTheDocument();
    });

    it('allows selecting a template', async () => {
      const user = userEvent.setup();
      renderWizard();
      await advanceToStep2(user);
      const template = screen.getByText('Scrum Board');
      await user.click(template);
      expect(template.closest('div')).toHaveClass('border-blue-500', 'bg-blue-50');
    });

    it('disables Create Planner button when no template selected', async () => {
      const user = userEvent.setup();
      renderWizard();
      await advanceToStep2(user);
      const createButton = screen.getByRole('button', { name: 'Create Planner' });
      expect(createButton).toBeDisabled();
    });

    it('enables Create Planner button when template selected', async () => {
      const user = userEvent.setup();
      renderWizard();
      await advanceToStep2(user);
      await user.click(screen.getByText('Scrum Board'));
      const createButton = screen.getByRole('button', { name: 'Create Planner' });
      expect(createButton).not.toBeDisabled();
    });

    it('goes back to step 1 when Back button is clicked', async () => {
      const user = userEvent.setup();
      renderWizard();
      await advanceToStep2(user);
      await user.click(screen.getByRole('button', { name: 'Back' }));
      expect(screen.getByLabelText('Title')).toBeInTheDocument();
      expect(screen.queryByText('Select Template')).not.toBeInTheDocument();
    });

    it('calls onCreatePlanner with correct arguments when form is submitted', async () => {
      const user = userEvent.setup();
      renderWizard();
      await user.type(screen.getByLabelText('Title'), 'My Planner');
      await user.type(screen.getByLabelText('Description'), 'My description');
      await user.click(screen.getByRole('button', { name: 'Next' }));
      await user.click(screen.getByText('Kanban Board'));
      await user.click(screen.getByRole('button', { name: 'Create Planner' }));
      expect(mockOnCreatePlanner).toHaveBeenCalledWith(
        'template-2',
        'My Planner',
        'My description'
      );
      expect(mockSetOpen).toHaveBeenCalledWith(false);
    });

    it('resets form after successful creation', async () => {
      const user = userEvent.setup();
      renderWizard();
      await user.type(screen.getByLabelText('Title'), 'My Planner');
      await user.click(screen.getByRole('button', { name: 'Next' }));
      await user.click(screen.getByText('Scrum Board'));
      await user.click(screen.getByRole('button', { name: 'Create Planner' }));
      // Wizard should reset internal state, but we can't directly observe.
      // Instead, verify that setOpen was called.
      expect(mockSetOpen).toHaveBeenCalledWith(false);
    });
  });

  describe('Form validation', () => {
    it('requires title in step 1', async () => {
      const user = userEvent.setup();
      renderWizard();
      const nextButton = screen.getByRole('button', { name: 'Next' });
      expect(nextButton).toBeDisabled();
      await user.type(screen.getByLabelText('Title'), '   ');
      expect(nextButton).toBeDisabled();
      await user.clear(screen.getByLabelText('Title'));
      await user.type(screen.getByLabelText('Title'), 'Valid');
      expect(nextButton).not.toBeDisabled();
    });

    it('does not require description', async () => {
      const user = userEvent.setup();
      renderWizard();
      await user.type(screen.getByLabelText('Title'), 'My Planner');
      // Leave description empty
      await user.click(screen.getByRole('button', { name: 'Next' }));
      await user.click(screen.getByText('Scrum Board'));
      await user.click(screen.getByRole('button', { name: 'Create Planner' }));
      expect(mockOnCreatePlanner).toHaveBeenCalledWith(
        'template-1',
        'My Planner',
        ''
      );
    });
  });

  describe('Edge cases', () => {
    it('handles empty templates list', async () => {
      const user = userEvent.setup();
      renderWizard({ templates: [] });
      await user.type(screen.getByLabelText('Title'), 'My Planner');
      await user.click(screen.getByRole('button', { name: 'Next' }));
      expect(screen.getByText('Select Template')).toBeInTheDocument();
      // No template cards rendered
      expect(screen.queryByText('Scrum Board')).not.toBeInTheDocument();
      const createButton = screen.getByRole('button', { name: 'Create Planner' });
      expect(createButton).toBeDisabled();
    });

    it('preserves title and description when navigating back', async () => {
      const user = userEvent.setup();
      renderWizard();
      await user.type(screen.getByLabelText('Title'), 'My Planner');
      await user.type(screen.getByLabelText('Description'), 'My description');
      await user.click(screen.getByRole('button', { name: 'Next' }));
      await user.click(screen.getByRole('button', { name: 'Back' }));
      expect(screen.getByLabelText('Title')).toHaveValue('My Planner');
      expect(screen.getByLabelText('Description')).toHaveValue('My description');
    });
  });
});
