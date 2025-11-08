package llm_profiles

import (
	"net/http"
	"strings"

	"zurabase/auth"
)

// RegisterRoutes registers the LLM profiles API routes with authentication
func RegisterRoutes(mux *http.ServeMux) {
	// GET /api/llm-profiles - List all profiles for the current user
	// POST /api/llm-profiles - Create a new profile
	mux.Handle("/api/llm-profiles", auth.AuthMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			HandleGetLLMProfiles(w, r)
		case http.MethodPost:
			HandleCreateLLMProfile(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})))

	// List available models from server - requires authentication
	mux.Handle("/api/llm-profiles/models", auth.AuthMiddleware(http.HandlerFunc(HandleListAvailableModels)))

	// Test connection to LLM server - requires authentication
	mux.Handle("/api/llm-profiles/test-connection", auth.AuthMiddleware(http.HandlerFunc(HandleTestLLMConnection)))

	// Handle routes with ID parameter - requires authentication
	mux.Handle("/api/llm-profiles/", auth.AuthMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/api/llm-profiles/")
		segments := strings.Split(path, "/")
		if len(segments) == 0 || segments[0] == "" {
			http.Error(w, "Invalid LLM profile path", http.StatusBadRequest)
			return
		}

		id := segments[0]

		// Nested route for test-stored-connection
		if len(segments) == 2 && segments[1] == "test-stored-connection" {
			if r.Method != http.MethodPost {
				http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
				return
			}
			HandleTestStoredLLMConnection(w, r, id)
			return
		}

		// Nested route for set-default
		if len(segments) == 2 && segments[1] == "set-default" {
			if r.Method != http.MethodPut {
				http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
				return
			}
			HandleSetDefaultLLMProfile(w, r, id)
			return
		}

		// Regular CRUD routes
		switch r.Method {
		case http.MethodGet:
			HandleGetLLMProfile(w, r, id)
		case http.MethodPut:
			HandleUpdateLLMProfile(w, r, id)
		case http.MethodDelete:
			HandleDeleteLLMProfile(w, r, id)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})))
}
