import React, { useState, useEffect } from "react";
import NavBar from "./NavBar";
import { BrowserRouter as Router, Routes, Route, useLocation } from "react-router-dom";
import StrandsApp from "../strands/StrandsApp";
import NotesApp from "../notes/NotesApp";
import PlannerApp from "../planner/PlannerApp";
import HomePage from "./HomePage";
import LoadingSplash from "./LoadingSplash";

/**
 * Main App component that serves as a landing page for the application.
 * It allows users to choose between the Notes and Planner features.
 */
function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

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
  let currentPage: "home" | "notes" | "planner" | "strands" = "home";
  
  if (path.startsWith("/notes")) {
    currentPage = "notes";
  } else if (path.startsWith("/planner")) {
    currentPage = "planner";
  } else if (path.startsWith("/strands")) {
    currentPage = "strands";
  }
  
  if (isLoading) {
    return <LoadingSplash />;
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar currentPage={currentPage} />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/notes/*" element={<NotesApp />} />
        <Route path="/planner/*" element={<PlannerApp />} />
        <Route path="/strands/*" element={<StrandsApp />} />
      </Routes>
    </div>
  );
};

export default App;
