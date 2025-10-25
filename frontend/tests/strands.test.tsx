import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import TagChip from "../src/strands/components/TagChip";
import StrandCard from "../src/strands/components/StrandCard";
import { Strand } from "../src/strands/types";

// Mock data
const mockStrand: Strand = {
  id: "test-strand-id",
  user_id: "test-user-id",
  content: "This is a test strand content",
  source: "test",
  tags: ["test", "jest"],
  summary: "Test strand summary",
  related_ids: [],
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

// Mock functions
const mockTagClick = jest.fn();
const mockEditClick = jest.fn();
const mockDeleteClick = jest.fn();

describe("TagChip Component", () => {
  it("renders tag correctly", () => {
    render(<TagChip tag="test" />);
    expect(screen.getByText("#test")).toBeInTheDocument();
  });

  it("handles click when clickable", () => {
    render(<TagChip tag="test" clickable onClick={mockTagClick} />);
    fireEvent.click(screen.getByText("#test"));
    expect(mockTagClick).toHaveBeenCalledWith("test");
  });

  it("handles remove when removable", () => {
    const mockRemove = jest.fn();
    render(<TagChip tag="test" removable onRemove={mockRemove} />);

    // Find the remove button (it contains an X icon)
    const removeButton = screen.getByRole("button", {
      name: /remove test tag/i,
    });
    fireEvent.click(removeButton);

    expect(mockRemove).toHaveBeenCalledWith("test");
  });

  it("adds # prefix if not present", () => {
    render(<TagChip tag="noprefix" />);
    expect(screen.getByText("#noprefix")).toBeInTheDocument();
  });

  it("does not add # prefix if already present", () => {
    render(<TagChip tag="#hasprefix" />);
    expect(screen.getByText("#hasprefix")).toBeInTheDocument();
    // Make sure we don't have ##hasprefix
    expect(screen.queryByText("##hasprefix")).not.toBeInTheDocument();
  });
});

describe("StrandCard Component", () => {
  it("renders strand content correctly", () => {
    render(<StrandCard strand={mockStrand} />);

    // Check if summary is displayed
    expect(screen.getByText(mockStrand.summary)).toBeInTheDocument();

    // Check if content is displayed
    expect(screen.getByText(mockStrand.content)).toBeInTheDocument();

    // Check if tags are displayed
    mockStrand.tags.forEach((tag) => {
      expect(screen.getByText(`#${tag}`)).toBeInTheDocument();
    });
  });

  it("handles tag click", () => {
    render(<StrandCard strand={mockStrand} onTagClick={mockTagClick} />);

    // Click on the first tag
    fireEvent.click(screen.getByText(`#${mockStrand.tags[0]}`));

    expect(mockTagClick).toHaveBeenCalledWith(mockStrand.tags[0]);
  });

  it("handles edit click", () => {
    render(<StrandCard strand={mockStrand} onEdit={mockEditClick} />);

    // Find and click the edit button
    const editButton = screen.getByRole("button", { name: /edit strand/i });
    fireEvent.click(editButton);

    expect(mockEditClick).toHaveBeenCalledWith(mockStrand);
  });

  it("handles delete click", () => {
    render(<StrandCard strand={mockStrand} onDelete={mockDeleteClick} />);

    // Find and click the delete button
    const deleteButton = screen.getByRole("button", { name: /delete strand/i });
    fireEvent.click(deleteButton);

    expect(mockDeleteClick).toHaveBeenCalledWith(mockStrand);
  });

  it("truncates long content", () => {
    const longContentStrand = {
      ...mockStrand,
      content: "A".repeat(200), // Create a long string
    };

    render(<StrandCard strand={longContentStrand} />);

    // The content should be truncated
    expect(screen.getByText(/A+\.\.\./)).toBeInTheDocument();
  });
});
