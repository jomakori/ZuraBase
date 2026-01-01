import "prosemirror-view/style/prosemirror.css";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "@/shared/components/App";
import { AuthProvider } from "@/features/auth/context/AuthContext";
import ErrorBoundary from "@/shared/components/ErrorBoundary";
import "@/styles/index.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <AuthProvider>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </AuthProvider>
  </React.StrictMode>
);
