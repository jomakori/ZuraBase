import React from "react";

// Mock App component
export const MockApp = () => {
  return <div data-testid="mock-app">Mock App Component</div>;
};

// Mock NotesApp component
export const MockNotesApp = () => {
  return <div data-testid="mock-notes-app">Mock Notes App Component</div>;
};

// Mock PlannerApp component
export const MockPlannerApp = () => {
  return <div data-testid="mock-planner-app">Mock Planner App Component</div>;
};

// Mock MarkdownEditor component
export const MockMarkdownEditor = ({ content }: { content: string }) => {
  return <div data-testid="markdown-editor">{content}</div>;
};

// Mock debounce utility
export const mockDebounce = (fn: any) => fn;
