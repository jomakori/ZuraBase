package notes

import (
	"encoding/json"
	"net/http"
	"strings"

	"zurabase/internal/httputil"
)

// HandleSaveNote handles POST /note
func HandleSaveNote(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		httputil.WriteJSONError(w, r, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	userID, _ := r.Context().Value("user_id").(string)

	var note Note
	if err := json.NewDecoder(r.Body).Decode(&note); err != nil {
		httputil.WriteJSONError(w, r, err.Error(), http.StatusBadRequest)
		return
	}

	// Assign user ID if authenticated
	if userID != "" {
		note.UserID = userID
	}

	// Always extract/update title when saving to ensure it reflects the latest header
	if note.Content != "" {
		note.Title = extractTitleFromContent(note.Content)
	} else if note.Text != "" {
		note.Title = extractTitleFromContent(note.Text)
	} else if note.Title == "" {
		note.Title = "Untitled Note"
	}

	savedNote, err := SaveNote(r.Context(), &note, userID)
	if err != nil {
		httputil.WriteJSONError(w, r, err.Error(), http.StatusInternalServerError)
		return
	}

	if err := json.NewEncoder(w).Encode(savedNote); err != nil {
		httputil.WriteJSONError(w, r, err.Error(), http.StatusInternalServerError)
	}
}

// HandleListNotes handles GET /notes?user_id={id}
func HandleListNotes(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		httputil.WriteJSONError(w, r, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		httputil.WriteJSONError(w, r, "Missing user_id parameter", http.StatusBadRequest)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	notes, err := GetNotesByUser(r.Context(), userID)
	if err != nil {
		httputil.WriteJSONError(w, r, err.Error(), http.StatusInternalServerError)
		return
	}

	// Ensure notes is not null; always return a JSON array not null
	if notes == nil {
		notes = []Note{}
	}
	if err := json.NewEncoder(w).Encode(notes); err != nil {
		httputil.WriteJSONError(w, r, err.Error(), http.StatusInternalServerError)
	}
}

// HandleGetNote handles GET /note/{id}
func HandleGetNote(w http.ResponseWriter, r *http.Request, id string) {
	if r.Method != http.MethodGet {
		httputil.WriteJSONError(w, r, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	note, err := GetNote(r.Context(), id)
	if err != nil {
		httputil.WriteJSONError(w, r, err.Error(), http.StatusNotFound)
		return
	}
	if err := json.NewEncoder(w).Encode(note); err != nil {
		httputil.WriteJSONError(w, r, err.Error(), http.StatusInternalServerError)
	}
}

// HandleDeleteNote handles DELETE /note/{id}
func HandleDeleteNote(w http.ResponseWriter, r *http.Request, id string) {
	if r.Method != http.MethodDelete {
		httputil.WriteJSONError(w, r, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if err := DeleteNote(r.Context(), id); err != nil {
		httputil.WriteJSONError(w, r, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// HandleNoteRequest routes requests to the appropriate handler
func HandleNoteRequest(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path

	// Normalize by removing "/api" prefix if present
	if strings.HasPrefix(path, "/api") {
		path = path[len("/api"):]
	}

	if path == "/note" {
		HandleSaveNote(w, r)
		return
	}

	if strings.HasPrefix(path, "/note/") {
		id := path[len("/note/"):]
		if id == "" {
			httputil.WriteJSONError(w, r, "Note ID is required", http.StatusBadRequest)
			return
		}

		switch r.Method {
		case http.MethodGet:
			HandleGetNote(w, r, id)
		case http.MethodDelete:
			HandleDeleteNote(w, r, id)
		default:
			httputil.WriteJSONError(w, r, "Method not allowed", http.StatusMethodNotAllowed)
		}
		return
	}

	http.NotFound(w, r)
}
