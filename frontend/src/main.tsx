import "prosemirror-view/style/prosemirror.css";
import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import App from "./components/App";
import { AuthProvider } from "./auth/AuthContext";
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
    const handleLocationChange = () => {
      const newPath = window.location.pathname;
      setPath(newPath);
    };

    // Listen for popstate events (back/forward)
    window.addEventListener("popstate", handleLocationChange);

    // Capture anchor clicks and handle internal routing
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
        window.history.pushState(null, "", anchor.href);
        setPath(newPath);
      }
    };

    document.addEventListener("click", handleLinkClick);

    return () => {
      window.removeEventListener("popstate", handleLocationChange);
      document.removeEventListener("click", handleLinkClick);
    };
  }, []);

  // Protected user dashboard route
  if (path.startsWith("/dashboard")) {
    const Dashboard = React.lazy(() => import("./components/Dashboard"));
    return (
      <ErrorBoundary>
        <React.Suspense fallback={<div>Loading Dashboard...</div>}>
          <Dashboard />
        </React.Suspense>
      </ErrorBoundary>
    );
  }

  // Routes
  if (path.startsWith("/notes")) {
    return (
      <ErrorBoundary>
        <NotesApp />
      </ErrorBoundary>
    );
  } else if (path.startsWith("/planner")) {
    return (
      <ErrorBoundary>
        <PlannerApp />
      </ErrorBoundary>
    );
  } else {
    const Landing = React.lazy(() => import("./components/App"));
    return (
      <ErrorBoundary>
        <React.Suspense fallback={<div>Loading...</div>}>
          <Landing />
        </React.Suspense>
      </ErrorBoundary>
    );
  }
};

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AuthProvider>
      <Router />
    </AuthProvider>
  </React.StrictMode>
);
