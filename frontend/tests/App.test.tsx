import React from "react";
import { render, screen } from "@testing-library/react";
import App from "../src/components/App";

test("renders App component", () => {
  render(<App />);
  const mainElement = screen.getByRole("main");
  const textElement = screen.getByText(/Mock App Component/i);
  expect(mainElement).toBeInTheDocument();
  expect(textElement).toBeInTheDocument();
});
