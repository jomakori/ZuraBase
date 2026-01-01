import React from "react";

type EditorCallback = (dom: HTMLElement) => void;

export const useEditor = (callback: EditorCallback) => {
  callback(document.createElement("div"));
  return { get: () => ({ state: {} }) };
};

interface ProviderProps {
  children: React.ReactNode;
}

export const MilkdownProvider = React.forwardRef<HTMLDivElement, ProviderProps>(
  ({ children }, ref) => <div ref={ref}>{children}</div>
);

/**
 * Mock Milkdown component for tests.
 * Renders a div with data-testid="markdown-editor" and the content prop if present.
 */
export const Milkdown = React.forwardRef<HTMLDivElement, any>(
  (props, ref) => {
    // Try to find the content prop from the parent MarkdownEditor
    // In tests, MarkdownEditor passes content as a prop, not as children
    const content = props.content || (props.children && typeof props.children === "string" ? props.children : null);
    return (
      <div
        ref={ref}
        role="textbox"
        // Only add data-testid if not already present in props
        {...(!props["data-testid"] && { "data-testid": "markdown-editor" })}
      >
        {content}
      </div>
    );
  }
);

export const defaultValueCtx = jest.fn();
export const rootCtx = jest.fn();
export const commonmark = jest.fn();
export const listener = jest.fn();
export const listenerCtx = {
  markdownUpdated: jest.fn(),
};

export const Editor = {
  make: () => ({
    config: (fn: (ctx: any) => void) => {
      fn({
        set: jest.fn(),
        get: () => ({ markdownUpdated: jest.fn() }),
      });
      return { use: jest.fn().mockReturnThis() };
    },
  }),
};

MilkdownProvider.displayName = "MilkdownProvider";
Milkdown.displayName = "Milkdown";
