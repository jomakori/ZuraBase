package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"zurabase/auth"
	"zurabase/notes"
	"zurabase/pexels"
	"zurabase/planner"
)

var mongoClient *mongo.Client

// HealthCheckResponse represents the response from the health check endpoint
type HealthCheckResponse struct {
	Status string `json:"status"`
	Error  string `json:"error,omitempty"`
}

// HealthCheck checks if the MongoDB connection is healthy
func HealthCheck(ctx context.Context) (*HealthCheckResponse, error) {
	if err := mongoClient.Ping(ctx, nil); err != nil {
		return &HealthCheckResponse{Status: "unhealthy", Error: "MongoDB connection failed"}, err
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
		
		// Log CORS settings without exposing full details
		fmt.Printf("[CORS] CORS configured for API\n")
		
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
	// Validate required environment variables
	requiredEnvVars := []string{"MONGO_URI", "UI_ENDPOINT"}
	for _, envVar := range requiredEnvVars {
		if os.Getenv(envVar) == "" {
			log.Fatalf("Required environment variable %s is not set", envVar)
		}
	}

	// Connect to MongoDB
	var err error
	mongoClient, err = mongo.Connect(context.Background(), options.Client().ApplyURI(os.Getenv("MONGO_URI")))
	if err != nil {
		log.Fatalf("Failed to connect to MongoDB: %v", err)
	}
	defer mongoClient.Disconnect(context.Background())

	// Initialize packages
	notes.Initialize(mongoClient, "zurabase")
	planner.Initialize(mongoClient, "zurabase")
	auth.Initialize(mongoClient, "zurabase")

	if err := planner.InitializeTemplates(context.Background()); err != nil {
		log.Fatalf("Failed to initialize planner templates: %v", err)
	}
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
	
	// Register authentication routes
	mux.HandleFunc("/auth/google", auth.HandleGoogleLogin)
	mux.HandleFunc("/auth/google/callback", auth.HandleGoogleCallback)
	mux.HandleFunc("/auth/user", func(w http.ResponseWriter, r *http.Request) {
		auth.AuthMiddleware(http.HandlerFunc(auth.HandleGetCurrentUser)).ServeHTTP(w, r)
	})
	mux.HandleFunc("/auth/logout", auth.HandleLogout)

	// Wrap existing mux with optional authentication middleware
	protectedMux := auth.OptionalAuthMiddleware(mux)

	// Create handler chain with CORS middleware
	handler := CORS(protectedMux)
	
	log.Println("Starting server on :8080")
	if err := http.ListenAndServe(":8080", handler); err != nil {
		log.Fatalf("Server failed: %s", err)
	}
}
