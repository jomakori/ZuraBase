import React from "react";

interface MarkdownEditorProps {
  content: string;
  setContent: (text: string) => void;
}

const MarkdownEditor: React.FC<MarkdownEditorProps> = ({ content }) => {
  return (
    <div role="textbox" data-testid="markdown-editor">
      {content}
    </div>
  );
};

export default MarkdownEditor;
