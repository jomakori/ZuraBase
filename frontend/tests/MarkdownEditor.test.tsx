/// <reference types="@testing-library/jest-dom" />
import React from "react";
import { render, screen } from "@testing-library/react";
import MarkdownEditor from "../src/components/MarkdownEditor";

describe("MarkdownEditor", () => {
  it("renders with content", async () => {
    const props = {
      content: "Test content",
      setContent: jest.fn(),
    };

    render(<MarkdownEditor {...props} />);
    const editors = await screen.findAllByTestId("markdown-editor");
    // Find the one that contains the expected text
    const editor = editors.find((el) =>
      el.textContent && el.textContent.includes("Test content")
    );
    expect(editor).toBeDefined();
    if (editor) {
      expect(editor).toHaveTextContent("Test content");
    }
  });
});
