package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"

	_ "github.com/lib/pq"
)

type Note struct {
	ID       string `json:"id"`
	Text     string `json:"text"`
	CoverURL string `json:"cover_url"`
}

var db *sql.DB

func init() {
	var err error

	// Build the connection string from environment variables
	connStr := fmt.Sprintf("postgres://%s:%s@%s/%s?sslmode=disable",
		os.Getenv("POSTGRES_USER"),
		os.Getenv("POSTGRES_PASSWORD"),
		os.Getenv("POSTGRES_HOST"),
		os.Getenv("POSTGRES_DB"),
	)

	// Open a connection to the database
	db, err = sql.Open("postgres", connStr)
	if err != nil {
		panic("failed to connect to the database: " + err.Error())
	}

	// Ensure the `note` table exists
	ctx := context.Background()
	_, err = db.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS note (
			id TEXT PRIMARY KEY,
			text TEXT,
			cover_url TEXT
		)
	`)
	if err != nil {
		panic("failed to ensure `note` table exists: " + err.Error())
	}
}

func SaveNote(ctx context.Context, note *Note) (*Note, error) {
	log.Printf("SaveNote: saving note: ID=%s, Text=%s, CoverURL=%s", note.ID, note.Text, note.CoverURL)
	// Save or update the note in the database.
	_, err := db.ExecContext(ctx, `
		INSERT INTO note (id, text, cover_url) VALUES ($1, $2, $3)
		ON CONFLICT (id) DO UPDATE SET text=$2, cover_url=$3
	`, note.ID, note.Text, note.CoverURL)
	if err != nil {
		log.Printf("SaveNote: error saving note: %v", err)
		return nil, err
	}
	return note, nil
}

func GetNote(ctx context.Context, id string) (*Note, error) {
	note := &Note{ID: id}
	err := db.QueryRowContext(ctx, `
		SELECT text, cover_url FROM note
		WHERE id = $1
	`, id).Scan(&note.Text, &note.CoverURL)
	if err != nil {
		log.Printf("GetNote: error retrieving note ID=%s: %v", id, err)
		return nil, err
	}
	log.Printf("GetNote: retrieved note: ID=%s, Text=%s, CoverURL=%s", note.ID, note.Text, note.CoverURL)
	return note, nil
}

func DeleteNote(ctx context.Context, id string) error {
	_, err := db.ExecContext(ctx, `DELETE FROM note WHERE id = $1`, id)
	return err
}

type HealthCheckResponse struct {
	Status string `json:"status"`
	Error  string `json:"error,omitempty"`
}

func HealthCheck(ctx context.Context) (*HealthCheckResponse, error) {
	var result int
	err := db.QueryRowContext(ctx, "SELECT 1").Scan(&result)
	if err != nil {
		return &HealthCheckResponse{Status: "unhealthy", Error: "Database connection failed"}, err
	}
	var tableExists string
	err = db.QueryRowContext(ctx, "SELECT to_regclass('public.note')").Scan(&tableExists)
	if err != nil || tableExists == "" {
		return &HealthCheckResponse{Status: "unhealthy", Error: "Table 'note' does not exist"}, err
	}
	return &HealthCheckResponse{Status: "healthy"}, nil
}

func main() {
	// Create a new router
	mux := http.NewServeMux()

	// Register routes
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		ctx := context.Background()
		response, err := HealthCheck(ctx)
		w.Header().Set("Content-Type", "application/json")
		if err != nil {
			w.WriteHeader(http.StatusInternalServerError)
			if err := json.NewEncoder(w).Encode(response); err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
			}
			return
		}
		w.WriteHeader(http.StatusOK)
		if err := json.NewEncoder(w).Encode(response); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
	})

	// Handle /note endpoint (POST only)
	mux.HandleFunc("/note", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		var note Note
		if err := json.NewDecoder(r.Body).Decode(&note); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		savedNote, err := SaveNote(r.Context(), &note)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		if err := json.NewEncoder(w).Encode(savedNote); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
	})

	// Handle /note/{id} endpoint (GET only)
	mux.HandleFunc("/note/", func(w http.ResponseWriter, r *http.Request) {
		// Extract ID from path
		path := r.URL.Path
		if len(path) <= len("/note/") {
			http.Error(w, "Note ID is required", http.StatusBadRequest)
			return
		}
		id := path[len("/note/"):]

		switch r.Method {
		case http.MethodGet:
			w.Header().Set("Content-Type", "application/json")
			note, err := GetNote(r.Context(), id)
			if err != nil {
				http.Error(w, err.Error(), http.StatusNotFound)
				return
			}
			if err := json.NewEncoder(w).Encode(note); err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
			}
		case http.MethodDelete:
			if err := DeleteNote(r.Context(), id); err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			w.WriteHeader(http.StatusNoContent)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})

	mux.HandleFunc("/images/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			return
		}

		query := r.URL.Path[len("/images/"):]
		if query == "" {
			http.Error(w, "Query parameter is required", http.StatusBadRequest)
			return
		}

		// Forward the request to the internal Pexels service
		photos, err := SearchPhoto(r.Context(), query)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		w.Header().Set("Content-Type", "application/json")
		if err := json.NewEncoder(w).Encode(photos); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
	})

	// Create handler chain with CORS middleware
	handler := CORS(mux)

	log.Println("Starting server on :8080")
	if err := http.ListenAndServe(":8080", handler); err != nil {
		log.Fatalf("Server failed: %s", err)
	}
}
