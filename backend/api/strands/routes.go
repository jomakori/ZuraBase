package strands

import (
	"net/http"
	"strings"
)

// HandleStrandsRequest routes requests to the appropriate handler
func HandleStrandsRequest(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path

	// Remove /api prefix if present
	path = strings.TrimPrefix(path, "/api")

	// Handle different routes
	switch {
	case path == "/strands/client-logs":
		HandleClientLogs(w, r)
		return

	case path == "/strands/sync":
		HandleSyncStrandsWithAI(w, r)
		return

	case path == "/strands/sync-unsynced":
		HandleSyncUnsyncedStrandsWithAI(w, r)
		return

	case path == "/strands/tags":
		HandleGetTags(w, r)
		return

	case path == "/strands":
		if r.Method == http.MethodPost {
			// Handle strand creation
			HandleCreateStrand(w, r)
			return
		}

		if r.Method == http.MethodGet {
			HandleGetStrands(w, r)
			return
		}

		http.Error(w, `{"error":"method not allowed"}`, http.StatusMethodNotAllowed)
		return

	case strings.HasPrefix(path, "/strands/"):
		// Extract ID and potential sub-path
		remainder := path[len("/strands/"):]

		// Check if this is a sync request for a specific strand
		if strings.HasSuffix(remainder, "/sync") {
			id := strings.TrimSuffix(remainder, "/sync")
			if r.Method == http.MethodPost {
				HandleSyncStrand(w, r, id)
				return
			}
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// Check if this is a sync-history request
		if strings.HasSuffix(remainder, "/sync-history") {
			id := strings.TrimSuffix(remainder, "/sync-history")
			if r.Method == http.MethodGet {
				HandleGetSyncHistory(w, r, id)
				return
			}
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// Check if this is a rollback request
		if strings.HasSuffix(remainder, "/rollback") {
			id := strings.TrimSuffix(remainder, "/rollback")
			if r.Method == http.MethodPost {
				HandleRollbackStrand(w, r, id)
				return
			}
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		// Otherwise, treat as a regular strand ID
		id := remainder

		// Handle different methods
		switch r.Method {
		case http.MethodGet:
			HandleGetStrand(w, r, id)
		case http.MethodPut:
			HandleUpdateStrand(w, r, id)
		case http.MethodDelete:
			HandleDeleteStrand(w, r, id)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
		return

	case path == "/strands/whatsapp":
		HandleWhatsAppWebhook(w, r)
		return
	}

	// If no route matches
	http.NotFound(w, r)
}
