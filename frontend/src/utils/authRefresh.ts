import { getApiBase } from "../getApiBase";

/**
 * Utility to handle authentication refresh when session issues are detected
 */

// Track if we're already attempting to refresh auth to prevent multiple redirects
let isRefreshingAuth = false;

/**
 * Check if the current authentication session is valid
 * @returns Promise<boolean> True if session is valid, false otherwise
 */
export async function checkAuthSession(): Promise<boolean> {
  try {
    const response = await fetch(`${getApiBase()}/auth/user`, {
      credentials: "include",
    });

    return response.ok;
  } catch (error) {
    console.error("Failed to check authentication status:", error);
    return false;
  }
}

/**
 * Handle authentication errors by checking session and redirecting if needed
 * @param status HTTP status code from the failed request
 * @returns Promise<boolean> True if handled (redirected), false otherwise
 */
export async function handleAuthError(status: number): Promise<boolean> {
  // Only handle 401 Unauthorized errors
  if (status !== 401) {
    return false;
  }

  // Prevent multiple redirects
  if (isRefreshingAuth) {
    return true;
  }

  isRefreshingAuth = true;

  try {
    // Double-check if session is actually invalid
    const isSessionValid = await checkAuthSession();

    if (!isSessionValid) {
      console.warn("Session has expired, redirecting to login page");
      // Show a message to the user
      const message = document.createElement("div");
      message.style.position = "fixed";
      message.style.top = "20px";
      message.style.left = "50%";
      message.style.transform = "translateX(-50%)";
      message.style.padding = "10px 20px";
      message.style.backgroundColor = "#f8d7da";
      message.style.color = "#721c24";
      message.style.borderRadius = "4px";
      message.style.zIndex = "9999";
      message.textContent =
        "Your session has expired. Redirecting to login page...";
      document.body.appendChild(message);

      // Give the user a chance to see what's happening
      setTimeout(() => {
        window.location.href = "/";
      }, 2000);

      return true;
    }
  } catch (error) {
    console.error("Error handling auth refresh:", error);
  } finally {
    isRefreshingAuth = false;
  }

  return false;
}

/**
 * Utility to handle network errors with appropriate feedback
 * @param error The error object
 * @returns string A user-friendly error message
 */
export function getNetworkErrorMessage(error: any): string {
  if (!error) {
    return "An unknown error occurred";
  }

  const errorMessage = error.message || String(error);

  if (
    errorMessage.includes("Failed to fetch") ||
    errorMessage.includes("net::ERR_CONNECTION_REFUSED")
  ) {
    return "The server is temporarily unavailable. Your changes will be saved when the connection is restored.";
  }

  if (errorMessage.includes("NetworkError")) {
    return "Network error. Please check your internet connection.";
  }

  if (errorMessage.includes("timeout")) {
    return "The request timed out. The server might be under heavy load.";
  }

  return errorMessage;
}
