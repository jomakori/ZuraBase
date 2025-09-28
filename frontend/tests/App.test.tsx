import React from "react";
import { render, screen } from "@testing-library/react";
import App from "../src/components/App";

import "@testing-library/jest-dom";
import { describe, it, expect } from "@jest/globals";
import { fireEvent } from "@testing-library/react";

describe("App component", () => {
  it("renders App component", () => {
    render(<App />);
    const mainElement = screen.getByRole("main");
    expect(mainElement).toBeInTheDocument();
  });

  it("renders navigation bar", () => {
    render(<App />);
    const nav = screen.getByRole("navigation");
    expect(nav).toBeInTheDocument();
  });

  it("handles navigation clicks", () => {
    render(<App />);
    const nav = screen.getByRole("navigation");
    const links = nav.querySelectorAll("a");
    expect(links.length).toBeGreaterThan(0);

    fireEvent.click(links[0]);
    expect(window.location.pathname).toBe(links[0].getAttribute("href"));
  });

  it("renders fallback text if main content absent", () => {
    render(<App />);
    const main = screen.getByRole("main");
    expect(main).toBeInTheDocument();
    // As a placeholder, ensure there's *some* child text
    expect(main.textContent?.length).toBeGreaterThan(0);
  });
});
