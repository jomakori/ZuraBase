import React from "react";
import { render, screen } from "@testing-library/react";
import CoverSelector from "../src/components/CoverSelector";
import debounce from "lodash.debounce";

// Mock lodash.debounce
jest.mock("lodash.debounce", () => jest.fn((fn) => fn));

test("renders CoverSelector component", () => {
  const mockProps = {
    open: true,
    setOpen: jest.fn(),
    setCoverImage: jest.fn(),
  };

  render(<CoverSelector {...mockProps} />);
  const dialog = screen.getByRole("dialog");
  const heading = screen.getByText("Select cover photo");
  expect(dialog).toBeInTheDocument();
  expect(heading).toBeInTheDocument();
});
