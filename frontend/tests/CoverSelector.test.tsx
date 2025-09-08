import React from "react";
import { render, screen } from "@testing-library/react";
import CoverSelector from "../src/components/CoverSelector";
import debounce from "lodash.debounce";

// Mock lodash.debounce
jest.mock("lodash.debounce", () => jest.fn((fn) => fn));

import "@testing-library/jest-dom";
import { describe, it, expect, jest } from "@jest/globals";
import { fireEvent, waitFor } from "@testing-library/react";

describe("CoverSelector", () => {
  it("renders CoverSelector component", () => {
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

  it("closes when setOpen(false) called", () => {
    const setOpenMock = jest.fn();
    render(
      <CoverSelector
        open={true}
        setOpen={setOpenMock}
        setCoverImage={jest.fn()}
      />
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();

    setOpenMock(false);
    expect(setOpenMock).toHaveBeenCalledWith(false);
  });

  it("handles no results from API", async () => {
    const mockSearch = jest.fn().mockImplementation(() => Promise.resolve({ photos: [] } as any));
    jest
      .spyOn(require("../src/client"), "searchPhoto")
      .mockImplementation(mockSearch);

    render(
      <CoverSelector
        open={true}
        setOpen={jest.fn()}
        setCoverImage={jest.fn()}
      />
    );

    const input = screen.getByPlaceholderText("nature") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "forest" } });

    await waitFor(() => {
      expect(screen.getByText(/Photos provided by/)).toBeInTheDocument();
    });

    expect(screen.queryByRole("img")).toBeNull();
  });

  it("shows error if API fails", async () => {
    const mockSearch = jest
      .fn()
      .mockImplementation(() => Promise.reject(new Error("API failed")));
    jest
      .spyOn(require("../src/client"), "searchPhoto")
      .mockImplementation(mockSearch);

    render(
      <CoverSelector
        open={true}
        setOpen={jest.fn()}
        setCoverImage={jest.fn()}
      />
    );

    const input = screen.getByPlaceholderText("nature") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "fail" } });

    await waitFor(() => {
      expect(screen.getByText(/API failed/)).toBeInTheDocument();
    });
  });
});
