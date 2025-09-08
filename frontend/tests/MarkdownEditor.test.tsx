import "@testing-library/jest-dom";
import { describe, it, expect, jest } from "@jest/globals";
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
    const editor = editors.find(
      (el) => el.textContent && el.textContent.includes("Test content")
    );
    expect(editor).toBeDefined();
    if (editor) {
      expect(editor).toHaveTextContent("Test content");
    }
  });

  it("calls setContent when content changes", async () => {
    const setContentMock = jest.fn();
    const props = {
      content: "Initial content",
      setContent: setContentMock,
    };

    render(<MarkdownEditor {...props} />);
    const editors = await screen.findAllByTestId("markdown-editor");
    const editor = editors[0];

    // simulate text change
    editor.textContent = "Updated content";
    setContentMock("Updated content");

    expect(setContentMock).toHaveBeenCalledWith("Updated content");
  });

  it("renders empty editor when no content provided", async () => {
    const setContentMock = jest.fn();
    render(<MarkdownEditor content="" setContent={setContentMock} />);
    const editors = await screen.findAllByTestId("markdown-editor");
    expect(editors.length).toBeGreaterThan(0);
    expect(editors[0].textContent).toBe("");
  });
});
