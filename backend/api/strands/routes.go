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
	case path == "/strands/sync":
		HandleSyncStrandsWithAI(w, r)
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
		// Extract ID from path
		id := path[len("/strands/"):]

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
