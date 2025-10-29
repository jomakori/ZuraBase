import "prosemirror-view/style/prosemirror.css";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./components/App";
import { AuthProvider } from "./auth/AuthContext";
import ErrorBoundary from "./components/ErrorBoundary";
import "./index.css";

// Apply React Router future settings to silence v7 warnings pre-emptively
(window as any).__REACT_ROUTER_FUTURE_FLAGS__ = {
  v7_startTransition: true,
  v7_relativeSplatPath: true,
};

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AuthProvider>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </AuthProvider>
  </React.StrictMode>
);
