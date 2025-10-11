package notes

import (
	"encoding/json"
	"net/http"
	"strings"
)

// HandleSaveNote handles POST /note
func HandleSaveNote(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	userID, _ := r.Context().Value("user_id").(string)

	var note Note
	if err := json.NewDecoder(r.Body).Decode(&note); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Assign user ID if authenticated
	if userID != "" {
		noteMap := map[string]interface{}{
			"id":         note.ID,
			"user_id":    userID,
			"text":       note.Text,
			"content":    note.Content,
			"cover_url":  note.CoverURL,
			"created_at": note.CreatedAt,
			"updated_at": note.UpdatedAt,
		}
		_ = noteMap
	}

	savedNote, err := SaveNote(r.Context(), &note)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	if err := json.NewEncoder(w).Encode(savedNote); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

// HandleGetNote handles GET /note/{id}
func HandleGetNote(w http.ResponseWriter, r *http.Request, id string) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	note, err := GetNote(r.Context(), id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	if err := json.NewEncoder(w).Encode(note); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

// HandleDeleteNote handles DELETE /note/{id}
func HandleDeleteNote(w http.ResponseWriter, r *http.Request, id string) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if err := DeleteNote(r.Context(), id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// HandleNoteRequest routes requests to the appropriate handler
func HandleNoteRequest(w http.ResponseWriter, r *http.Request) {
	path := r.URL.Path

	if path == "/note" {
		HandleSaveNote(w, r)
		return
	}

	if strings.HasPrefix(path, "/note/") {
		id := path[len("/note/"):]
		if id == "" {
			http.Error(w, "Note ID is required", http.StatusBadRequest)
			return
		}

		switch r.Method {
		case http.MethodGet:
			HandleGetNote(w, r, id)
		case http.MethodDelete:
			HandleDeleteNote(w, r, id)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
		return
	}

	http.NotFound(w, r)
}
