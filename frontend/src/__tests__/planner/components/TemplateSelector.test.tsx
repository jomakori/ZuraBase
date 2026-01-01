/**
 * Tests for TemplateSelector component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TemplateSelector from '@/features/planner/components/TemplateSelector';
import { PlannerTemplate } from '@/features/planner/types';

describe('TemplateSelector', () => {
  const mockOnSelect = jest.fn();
  const mockOnCancel = jest.fn();

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
    {
      id: 'template-3',
      name: 'Personal Planner',
      type: 'personal',
      description: 'Simple personal task management',
      created_at: '2024-01-03T00:00:00Z',
      lanes: [],
    },
  ];

  const defaultProps = {
    templates: mockTemplates,
    onSelect: mockOnSelect,
    onCancel: mockOnCancel,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderTemplateSelector = (overrides: Partial<typeof defaultProps> = {}) => {
    const props = { ...defaultProps, ...overrides };
    return render(<TemplateSelector {...props} />);
  };

  describe('Rendering', () => {
    it('renders title and description inputs', () => {
      renderTemplateSelector();
      expect(screen.getByLabelText('Title')).toBeInTheDocument();
      expect(screen.getByLabelText('Description')).toBeInTheDocument();
    });

    it('renders all templates', () => {
      renderTemplateSelector();
      expect(screen.getByText('Scrum Board')).toBeInTheDocument();
      expect(screen.getByText('A board for Scrum sprints')).toBeInTheDocument();
      expect(screen.getByText('Kanban Board')).toBeInTheDocument();
      expect(screen.getByText('Personal Planner')).toBeInTheDocument();
    });

    it('renders cancel and create buttons', () => {
      renderTemplateSelector();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Create Planner' })).toBeInTheDocument();
    });

    it('disables create button when no template selected', () => {
      renderTemplateSelector();
      const createButton = screen.getByRole('button', { name: 'Create Planner' });
      expect(createButton).toBeDisabled();
    });

    it('disables create button when title is empty', () => {
      renderTemplateSelector();
      // Select a template
      fireEvent.click(screen.getByText('Scrum Board'));
      const createButton = screen.getByRole('button', { name: 'Create Planner' });
      expect(createButton).toBeDisabled(); // because title is empty
    });
  });

  describe('User Interactions', () => {
    it('selects a template when clicked', async () => {
      const user = userEvent.setup();
      renderTemplateSelector();
      const templateElement = screen.getByText('Scrum Board');
      await user.click(templateElement);
      // The template should have selected styling (border-blue-500 bg-blue-50)
      expect(templateElement.closest('div')).toHaveClass('border-blue-500', 'bg-blue-50');
    });

    it('only one template can be selected at a time', async () => {
      const user = userEvent.setup();
      renderTemplateSelector();
      const template1 = screen.getByText('Scrum Board');
      const template2 = screen.getByText('Kanban Board');
      await user.click(template1);
      expect(template1.closest('div')).toHaveClass('border-blue-500');
      expect(template2.closest('div')).not.toHaveClass('border-blue-500');
      await user.click(template2);
      expect(template1.closest('div')).not.toHaveClass('border-blue-500');
      expect(template2.closest('div')).toHaveClass('border-blue-500');
    });

    it('enables create button when template selected and title filled', async () => {
      const user = userEvent.setup();
      renderTemplateSelector();
      await user.click(screen.getByText('Scrum Board'));
      await user.type(screen.getByLabelText('Title'), 'My Planner');
      const createButton = screen.getByRole('button', { name: 'Create Planner' });
      expect(createButton).not.toBeDisabled();
    });

    it('calls onSelect with correct arguments when form is submitted', async () => {
      const user = userEvent.setup();
      renderTemplateSelector();
      // Select template
      await user.click(screen.getByText('Kanban Board'));
      // Fill title and description
      await user.type(screen.getByLabelText('Title'), 'My Kanban');
      await user.type(screen.getByLabelText('Description'), 'A description');
      // Submit
      await user.click(screen.getByRole('button', { name: 'Create Planner' }));
      expect(mockOnSelect).toHaveBeenCalledWith(
        'template-2',
        'My Kanban',
        'A description'
      );
    });

    it('calls onCancel when cancel button is clicked', async () => {
      const user = userEvent.setup();
      renderTemplateSelector();
      await user.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(mockOnCancel).toHaveBeenCalledTimes(1);
    });

    it('prevents default form submission', async () => {
      const user = userEvent.setup();
      renderTemplateSelector();
      // Select template and fill title
      await user.click(screen.getByText('Scrum Board'));
      await user.type(screen.getByLabelText('Title'), 'Test');
      const form = screen.getByRole('form');
      const submitEvent = new Event('submit', { cancelable: true });
      const preventDefaultSpy = jest.spyOn(submitEvent, 'preventDefault');
      fireEvent(form, submitEvent);
      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe('Validation', () => {
    it('requires title', async () => {
      const user = userEvent.setup();
      renderTemplateSelector();
      await user.click(screen.getByText('Scrum Board'));
      const createButton = screen.getByRole('button', { name: 'Create Planner' });
      expect(createButton).toBeDisabled();
      await user.type(screen.getByLabelText('Title'), ' ');
      expect(createButton).toBeDisabled(); // whitespace only
      await user.clear(screen.getByLabelText('Title'));
      await user.type(screen.getByLabelText('Title'), 'Valid');
      expect(createButton).not.toBeDisabled();
    });

    it('does not require description', async () => {
      const user = userEvent.setup();
      renderTemplateSelector();
      await user.click(screen.getByText('Scrum Board'));
      await user.type(screen.getByLabelText('Title'), 'My Planner');
      // Leave description empty
      const createButton = screen.getByRole('button', { name: 'Create Planner' });
      expect(createButton).not.toBeDisabled();
      await user.click(createButton);
      expect(mockOnSelect).toHaveBeenCalledWith(
        'template-1',
        'My Planner',
        ''
      );
    });
  });

  describe('Edge cases', () => {
    it('handles empty templates list', () => {
      renderTemplateSelector({ templates: [] });
      expect(screen.queryByRole('button', { name: 'Create Planner' })).toBeDisabled();
      expect(screen.getByText('Select Template')).toBeInTheDocument();
      // No template cards rendered
      expect(screen.queryByText('Scrum Board')).not.toBeInTheDocument();
    });

    it('preserves title and description after template selection', async () => {
      const user = userEvent.setup();
      renderTemplateSelector();
      await user.type(screen.getByLabelText('Title'), 'My Title');
      await user.type(screen.getByLabelText('Description'), 'My Description');
      await user.click(screen.getByText('Scrum Board'));
      expect(screen.getByLabelText('Title')).toHaveValue('My Title');
      expect(screen.getByLabelText('Description')).toHaveValue('My Description');
    });
  });
});
