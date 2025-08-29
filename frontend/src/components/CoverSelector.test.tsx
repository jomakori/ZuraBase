
import React from "react";
import { render, screen, act, waitFor, fireEvent } from "@testing-library/react";
import CoverSelector from "./CoverSelector";
import debounce from "lodash.debounce";

// Mock lodash.debounce
jest.mock("lodash.debounce", () => (fn: any) => fn);

test("renders CoverSelector component", () => {
  const mockProps = {
    open: true,
    setOpen: jest.fn(),
    setCoverImage: jest.fn(),
    client: {
      images: {
        search: jest.fn().mockResolvedValue({ images: [] }),
      },
    },
  };

  render(<CoverSelector {...mockProps} />);
  const dialog = screen.getByRole("dialog");
  const heading = screen.getByText("Select cover photo");
  expect(dialog).toBeInTheDocument();
  expect(heading).toBeInTheDocument();
});
test("shows loading indicator and displays results after search", async () => {
  const mockSetCoverImage = jest.fn();
  const mockSetOpen = jest.fn();
  const mockPhotos = [
    {
      id: 1,
      src: { medium: "medium.jpg", landscape: "landscape.jpg" },
      alt: "Nature",
    },
  ];
  const mockSearch = jest.fn().mockResolvedValue({ photos: mockPhotos });
  jest.spyOn(require("../client"), "searchPhoto").mockImplementation(mockSearch);

  render(
    <CoverSelector
      open={true}
      setOpen={mockSetOpen}
      setCoverImage={mockSetCoverImage}
    />
  );

  const input = screen.getByPlaceholderText("nature") as HTMLInputElement;
  fireEvent.change(input, { target: { value: "forest" } });

  try {
    await waitFor(() => {
      expect(screen.getByText(/Loading/)).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByText(/Photos provided by/)).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByAltText("Nature")).toBeInTheDocument();
    });
  } catch (e) {
    // Print the DOM for debugging
    // eslint-disable-next-line no-console
    console.log(screen.debug());
    throw e;
  }

  // Click the photo to select
  const photo = screen.getByAltText("Nature");
  photo.click();
  expect(mockSetCoverImage).toHaveBeenCalledWith("landscape.jpg");
  expect(mockSetOpen).toHaveBeenCalledWith(false);
});

test("shows error message on search failure", async () => {
  const mockSetCoverImage = jest.fn();
  const mockSetOpen = jest.fn();
  const mockSearch = jest.fn().mockRejectedValue({ message: "API error" });
  jest.spyOn(require("../client"), "searchPhoto").mockImplementation(mockSearch);

  render(
    <CoverSelector
      open={true}
      setOpen={mockSetOpen}
      setCoverImage={mockSetCoverImage}
    />
  );

  const input = screen.getByPlaceholderText("nature") as HTMLInputElement;
  fireEvent.change(input, { target: { value: "fail" } });

  try {
    await waitFor(() => {
      expect(screen.getByText(/API error/)).toBeInTheDocument();
    });
  } catch (e) {
    // Print the DOM for debugging
    // eslint-disable-next-line no-console
    console.log(screen.debug());
    throw e;
  }
});

test("close button closes the modal", () => {
  const mockSetOpen = jest.fn();
  render(
    <CoverSelector
      open={true}
      setOpen={mockSetOpen}
      setCoverImage={jest.fn()}
    />
  );
  const closeButton = screen.getAllByRole("button")[0];
  closeButton.click();
  expect(mockSetOpen).toHaveBeenCalledWith(false);
});
