import React, { useState, useEffect } from "react";
import NavBar from "./NavBar";
import {
  createBrowserRouter,
  RouterProvider,
  Outlet,
  useLocation,
} from "react-router-dom";
import StrandsApp from "../strands/StrandsApp";
import NotesApp from "../notes/NotesApp";
import PlannerApp from "../planner/PlannerApp";
import HomePage from "./HomePage";
import SettingsPage from "./SettingsPage";
import LoadingSplash from "./LoadingSplash";
import AIConnectionStatus from "./LLMConnectionStatus";
import { LLMProfilesProvider } from "../context/LLMProfilesProvider";

// Main content component with loading state
const AppContent = () => {
  const location = useLocation();
  const [isLoading, setIsLoading] = useState(false);

  // Track location changes to show loading animation
  useEffect(() => {
    setIsLoading(true);
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500); // Short delay to show loading animation

    return () => clearTimeout(timer);
  }, [location.pathname]);

  // Determine current page for NavBar
  const path = location.pathname;
  let currentPage: "home" | "notes" | "planner" | "strands" | "settings" =
    "home";

  if (path.startsWith("/notes")) {
    currentPage = "notes";
  } else if (path.startsWith("/planner")) {
    currentPage = "planner";
  } else if (path.startsWith("/strands")) {
    currentPage = "strands";
  } else if (path.startsWith("/settings")) {
    currentPage = "settings";
  }

  if (isLoading) {
    return <LoadingSplash />;
  }

  return (
    <LLMProfilesProvider>
      <div className="min-h-screen bg-gray-50">
        <NavBar currentPage={currentPage} />
        <Outlet />
        <AIConnectionStatus />
      </div>
    </LLMProfilesProvider>
  );
};

// Create router with v7 future flags
const router = createBrowserRouter([
  {
    path: "/",
    element: <AppContent />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      {
        path: "notes/*",
        element: <NotesApp />,
      },
      {
        path: "planner/*",
        element: <PlannerApp />,
      },
      {
        path: "strands/*",
        element: <StrandsApp />,
      },
      {
        path: "settings",
        element: <SettingsPage />,
      },
    ],
  },
]);

/**
 * Main App component that serves as a landing page for the application.
 * It allows users to choose between the Notes and Planner features.
 */
function App() {
  return (
    <RouterProvider
      router={router}
      future={{
        v7_startTransition: true,
      }}
    />
  );
}

export default App;
