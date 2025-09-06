package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	_ "github.com/lib/pq"

	"zurabase/notes"
	"zurabase/pexels"
	"zurabase/planner"
)

var db *sql.DB

// HealthCheckResponse represents the response from the health check endpoint
type HealthCheckResponse struct {
	Status string `json:"status"`
	Error  string `json:"error,omitempty"`
}

// HealthCheck checks if the database connection is healthy
func HealthCheck(ctx context.Context) (*HealthCheckResponse, error) {
	var result int
	err := db.QueryRowContext(ctx, "SELECT 1").Scan(&result)
	if err != nil {
		return &HealthCheckResponse{Status: "unhealthy", Error: "Database connection failed"}, err
	}
	
	// Check if required tables exist
	tables := []string{"note", "planner_template", "planner", "planner_lane", "planner_card"}
	for _, table := range tables {
		var tableExists string
		err = db.QueryRowContext(ctx, fmt.Sprintf("SELECT to_regclass('public.%s')", table)).Scan(&tableExists)
		if err != nil || tableExists == "" {
			return &HealthCheckResponse{Status: "unhealthy", Error: fmt.Sprintf("Table '%s' does not exist", table)}, err
		}
	}
	
	return &HealthCheckResponse{Status: "healthy"}, nil
}

// CORS middleware adds the necessary CORS headers to allow cross-origin requests
func CORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Get allowed origin from UI_ENDPOINT environment variable
		allowedOrigin := os.Getenv("UI_ENDPOINT")
		// If empty, log an error but continue with empty value (which will block all CORS)
		if allowedOrigin == "" {
			log.Printf("[CORS] ERROR: UI_ENDPOINT environment variable is not set. CORS will not work properly.")
		}
		
		// Log CORS settings for debugging
		fmt.Printf("[CORS] Using allowed origin: %s\n", allowedOrigin)
		
		// Set CORS headers
		w.Header().Set("Access-Control-Allow-Origin", allowedOrigin)
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Credentials", "true")

		// Handle preflight requests
		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		// Call the next handler
		next.ServeHTTP(w, r)
	})
}

func main() {
	// Initialize database connection
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
		log.Fatalf("Failed to connect to the database: %v", err)
	}
	
	// Ensure the required tables exist
	ctx := context.Background()
	
	// Create note table if it doesn't exist
	_, err = db.ExecContext(ctx, `
		CREATE TABLE IF NOT EXISTS note (
			id TEXT PRIMARY KEY,
			text TEXT,
			cover_url TEXT
		)
	`)
	if err != nil {
		log.Fatalf("Failed to ensure note table exists: %v", err)
	}
	
	// Create planner tables if they don't exist
	_, err = db.ExecContext(ctx, `
		-- Create planner_template table
		CREATE TABLE IF NOT EXISTS planner_template (
		  id TEXT PRIMARY KEY,
		  name TEXT NOT NULL,
		  type TEXT NOT NULL,
		  description TEXT,
		  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
		);

		-- Create planner_template_lane table
		CREATE TABLE IF NOT EXISTS planner_template_lane (
		  id TEXT PRIMARY KEY,
		  template_id TEXT NOT NULL REFERENCES planner_template(id) ON DELETE CASCADE,
		  name TEXT NOT NULL,
		  description TEXT,
		  position INTEGER NOT NULL,
		  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
		);

		-- Create planner table
		CREATE TABLE IF NOT EXISTS planner (
		  id TEXT PRIMARY KEY,
		  title TEXT NOT NULL,
		  description TEXT,
		  template_id TEXT NOT NULL REFERENCES planner_template(id),
		  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
		  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
		);

		-- Create planner_lane table
		CREATE TABLE IF NOT EXISTS planner_lane (
		  id TEXT PRIMARY KEY,
		  planner_id TEXT NOT NULL REFERENCES planner(id) ON DELETE CASCADE,
		  template_lane_id TEXT REFERENCES planner_template_lane(id),
		  title TEXT NOT NULL,
		  position INTEGER NOT NULL,
		  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
		  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
		);

		-- Create planner_card table
		CREATE TABLE IF NOT EXISTS planner_card (
		  id TEXT PRIMARY KEY,
		  lane_id TEXT NOT NULL REFERENCES planner_lane(id) ON DELETE CASCADE,
		  title TEXT NOT NULL,
		  content TEXT,
		  position INTEGER NOT NULL,
		  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
		  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
		);
	`)
	if err != nil {
		log.Fatalf("Failed to ensure planner tables exist: %v", err)
	}
	
	// Initialize the notes and planner packages with the database connection
	notes.Initialize(db)
	planner.Initialize(db)
	
	// Initialize planner templates
	if err := planner.InitializeTemplates(context.Background()); err != nil {
		log.Fatalf("Failed to initialize planner templates: %v", err)
	}
	
	// Create a new router
	mux := http.NewServeMux()
	
	// Register health check route
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
	
	// Register notes routes
	mux.HandleFunc("/note", notes.HandleNoteRequest)
	mux.HandleFunc("/note/", notes.HandleNoteRequest)
	
	// Register planner routes
	mux.HandleFunc("/planner", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			planner.HandleCreatePlanner(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	})
	
	mux.HandleFunc("/planner/", func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		
		// Handle /planner/templates
		if path == "/planner/templates" {
			planner.HandleGetTemplates(w, r)
			return
		}
		
		// Handle /planner/templates/{id}
		if strings.HasPrefix(path, "/planner/templates/") {
			planner.HandleGetTemplate(w, r)
			return
		}
		
		// Handle /planner/import
		if path == "/planner/import" {
			planner.HandleImportPlannerMarkdown(w, r)
			return
		}
		
		// Handle /planner/{id}/export
		if strings.HasSuffix(path, "/export") {
			planner.HandleExportPlannerMarkdown(w, r)
			return
		}
		
		// Handle /planner/{id}/lanes/reorder
		if strings.HasSuffix(path, "/lanes/reorder") {
			planner.HandleReorderLanes(w, r)
			return
		}
		
		// Handle /planner/{id}/lane/{laneId}/cards/reorder
		if strings.Contains(path, "/lane/") && strings.HasSuffix(path, "/cards/reorder") {
			planner.HandleReorderCards(w, r)
			return
		}
		
		// Handle /planner/{id}/lane/{laneId}/split
		if strings.Contains(path, "/lane/") && strings.HasSuffix(path, "/split") {
			planner.HandleSplitLane(w, r)
			return
		}
		
		// Handle /planner/{id}/lane/{laneId}/card
		if strings.Contains(path, "/lane/") && strings.HasSuffix(path, "/card") {
			planner.HandleAddCard(w, r)
			return
		}
		
		// Handle /planner/{id}/lane/{laneId}/card/{cardId}
		if strings.Contains(path, "/lane/") && strings.Contains(path, "/card/") {
			parts := strings.Split(path, "/")
			if len(parts) == 7 {
				switch r.Method {
				case http.MethodGet:
					planner.HandleGetCard(w, r)
				case http.MethodPut:
					planner.HandleUpdateCard(w, r)
				case http.MethodDelete:
					planner.HandleDeleteCard(w, r)
				default:
					http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
				}
				return
			}
		}
		
		// Handle /planner/{id}/card/{cardId}/move
		if strings.Contains(path, "/card/") && strings.HasSuffix(path, "/move") {
			planner.HandleMoveCard(w, r)
			return
		}
		
		// Handle /planner/{id}/lane
		if strings.HasSuffix(path, "/lane") {
			planner.HandleAddLane(w, r)
			return
		}
		
		// Handle /planner/{id}/lane/{laneId}
		if strings.Contains(path, "/lane/") {
			parts := strings.Split(path, "/")
			if len(parts) == 5 {
				switch r.Method {
				case http.MethodPut:
					planner.HandleUpdateLane(w, r)
				case http.MethodDelete:
					planner.HandleDeleteLane(w, r)
				default:
					http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
				}
				return
			}
		}
		
		// Handle /planner/{id}
		parts := strings.Split(path, "/")
		if len(parts) == 3 {
			switch r.Method {
			case http.MethodGet:
				planner.HandleGetPlanner(w, r)
			case http.MethodPut:
				planner.HandleUpdatePlanner(w, r)
			case http.MethodDelete:
				planner.HandleDeletePlanner(w, r)
			default:
				http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			}
			return
		}
		
		http.NotFound(w, r)
	})
	
	// Register image search route
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
		photos, err := pexels.SearchPhoto(r.Context(), query)
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
