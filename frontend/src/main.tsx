import "prosemirror-view/style/prosemirror.css";
import React, { useEffect, useState, Suspense } from "react";
import ReactDOM from "react-dom/client";
import App from "./components/App";
import { NotesApp } from "./notes";
import { PlannerApp } from "./planner";
import "./index.css";

// Fallback component to display when there's an error
const ErrorFallback = ({ error }: { error: Error }) => {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6">
        <h2 className="text-2xl font-bold text-red-600 mb-4">
          Application Error
        </h2>
        <div className="bg-red-50 border border-red-200 rounded p-4 mb-4">
          <p className="text-red-800 font-medium">{error.message}</p>
        </div>
        <p className="mb-4 text-gray-600">This could be due to:</p>
        <ul className="list-disc pl-5 mb-4 text-gray-600">
          <li>Missing environment variables</li>
          <li>Backend service not running</li>
          <li>Network connectivity issues</li>
        </ul>
        <button
          onClick={() => window.location.reload()}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded"
        >
          Reload Application
        </button>
      </div>
    </div>
  );
};

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

  // Error boundary
  if (error) {
    return <ErrorFallback error={error} />;
  }

  try {
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
      return <NotesApp />;
    } else if (path.startsWith("/planner")) {
      console.log("[Router] Rendering PlannerApp");
      return <PlannerApp />;
    } else {
      console.log("[Router] Rendering App");
      return <App />;
    }
  } catch (err) {
    console.error("[Router] Error rendering component:", err);
    setError(err as Error);
    return null;
  }
};

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <Router />
  </React.StrictMode>
);
