import "prosemirror-view/style/prosemirror.css";
import React, { useEffect, useState, Suspense } from "react";
import ReactDOM from "react-dom/client";
import App from "./components/App";
import { NotesApp } from "./notes";
import { PlannerApp } from "./planner";
import ErrorBoundary from "./components/ErrorBoundary";
import "./index.css";

// Simple router component that renders different components based on the URL path
export const Router: React.FC = () => {
  const [path, setPath] = useState(window.location.pathname);
  const [error, setError] = useState<Error | null>(null);

  // Update path when the URL changes
  useEffect(() => {
    console.log("[Router] Initial path:", path);

    const handleLocationChange = () => {
      const newPath = window.location.pathname;
      console.log("[Router] Path changed:", newPath);
      setPath(newPath);
    };

    // Listen for popstate events (back/forward navigation)
    window.addEventListener("popstate", handleLocationChange);

    // Also listen for click events on links to update the path
    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest("a");
      if (
        anchor &&
        anchor.href &&
        anchor.href.startsWith(window.location.origin)
      ) {
        e.preventDefault();
        const newPath = new URL(anchor.href).pathname;
        console.log("[Router] Link clicked, new path:", newPath);
        window.history.pushState(null, "", anchor.href);
        setPath(newPath);
      }
    };

    document.addEventListener("click", handleLinkClick);

    return () => {
      window.removeEventListener("popstate", handleLocationChange);
      document.removeEventListener("click", handleLinkClick);
    };
  }, [path]);

  // Render the appropriate component based on the path
  console.log("[Router] Rendering component for path:", path);

  // Add debugging for API endpoint
  try {
    // Use import.meta instead of require
    import("./getApiBase").then(({ getApiBase }) => {
      console.log("[Router] API Base URL:", getApiBase());
    }).catch(apiErr => {
      console.error("[Router] Error importing getApiBase:", apiErr);
    });
  } catch (apiErr) {
    console.error("[Router] Error getting API base URL:", apiErr);
  }

  if (path.startsWith("/notes")) {
    console.log("[Router] Rendering NotesApp");
    return (
      <ErrorBoundary>
        <NotesApp />
      </ErrorBoundary>
    );
  } else if (path.startsWith("/planner")) {
    console.log("[Router] Rendering PlannerApp");
    return (
      <ErrorBoundary>
        <PlannerApp />
      </ErrorBoundary>
    );
  } else {
    console.log("[Router] Rendering App");
    return (
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    );
  }
};

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Router />
  </React.StrictMode>
);
