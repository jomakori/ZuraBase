package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strings"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"zurabase/api/llm_profiles"
	"zurabase/api/strands"
	"zurabase/auth"
	"zurabase/models"
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
		origin := r.Header.Get("Origin")
		if origin == "" {
			origin = "*"
		}
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Vary", "Origin")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		w.Header().Set("Access-Control-Allow-Credentials", "true")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusNoContent)
			return
		}

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
	models.Initialize(mongoClient, "zurabase")

	// Initialize LLM profiles
	if err := models.InitializeLLMProfiles(mongoClient, "zurabase"); err != nil {
		log.Printf("Warning: LLM profiles initialization error: %v", err)
	} else {
		log.Println("✅ LLM profiles initialized successfully")
	}

	// ✅ Ensure models (i.e., strands collection) are initialized before strands module uses them
	log.Println("✅ MongoDB models initialized successfully")

	// Initialize strands module (AI + Tag Service)
	if err := strands.Initialize(); err != nil {
		log.Printf("Warning: Strands initialization error: %v", err)
	} else {
		log.Println("✅ Strands module initialized successfully")
	}

	// Initialize persistent WhatsApp connection
	ctx := context.Background()
	if err := strands.InitializeWhatsApp(ctx); err != nil {
		log.Printf("Warning: WhatsApp initialization failed: %v", err)
	} else {
		log.Println("✅ WhatsApp integration initialized successfully")
	}

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

	// generic helper to mount all routes (DRY)
	type route struct {
		path    string
		handler http.HandlerFunc
	}
	mountRoutes := func(mux *http.ServeMux, routes []route) {
		for _, r := range routes {
			mux.HandleFunc(r.path, r.handler)
			mux.HandleFunc("/api"+r.path, r.handler)
		}
	}

	// --- Grouped routes ---
	// Register notes routes with OptionalAuthMiddleware to allow access while logged out
	mux.Handle("/api/note", auth.OptionalAuthMiddleware(http.HandlerFunc(notes.HandleNoteRequest)))
	mux.Handle("/note", auth.OptionalAuthMiddleware(http.HandlerFunc(notes.HandleNoteRequest)))

	mux.Handle("/api/note/", auth.OptionalAuthMiddleware(http.HandlerFunc(notes.HandleNoteRequest)))
	mux.Handle("/note/", auth.OptionalAuthMiddleware(http.HandlerFunc(notes.HandleNoteRequest)))

	mux.Handle("/api/notes", auth.OptionalAuthMiddleware(http.HandlerFunc(notes.HandleListNotes)))
	mux.Handle("/notes", auth.OptionalAuthMiddleware(http.HandlerFunc(notes.HandleListNotes)))

	plannerRoutes := []route{
		{"/planner/list", planner.HandleListPlanners},
		{"/planner", func(w http.ResponseWriter, r *http.Request) {
			if r.Method == http.MethodPost {
				planner.HandleCreatePlanner(w, r)
			} else {
				http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
			}
		}},
		{"/planner/", func(w http.ResponseWriter, r *http.Request) {
			path := strings.TrimPrefix(r.URL.Path, "/api")
			switch {
			case path == "/planner/templates":
				planner.HandleGetTemplates(w, r)
			case strings.HasPrefix(path, "/planner/templates/"):
				planner.HandleGetTemplate(w, r)
			case path == "/planner/import":
				planner.HandleImportPlannerMarkdown(w, r)
			case strings.HasSuffix(path, "/export"):
				planner.HandleExportPlannerMarkdown(w, r)
			case strings.HasSuffix(path, "/lanes/reorder"):
				planner.HandleReorderLanes(w, r)
			case strings.Contains(path, "/lane/") && strings.HasSuffix(path, "/cards/reorder"):
				planner.HandleReorderCards(w, r)
			case strings.Contains(path, "/lane/") && strings.HasSuffix(path, "/split"):
				planner.HandleSplitLane(w, r)
			case strings.Contains(path, "/lane/") && strings.HasSuffix(path, "/card"):
				planner.HandleAddCard(w, r)
			case strings.Contains(path, "/lane/") && strings.Contains(path, "/card/"):
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
			case strings.Contains(path, "/card/") && strings.HasSuffix(path, "/move"):
				planner.HandleMoveCard(w, r)
			case strings.HasSuffix(path, "/lane"):
				planner.HandleAddLane(w, r)
			case strings.Contains(path, "/lane/"):
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
			default:
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
			}
		}},
	}

	imageRoutes := []route{
		{"/images/", func(w http.ResponseWriter, r *http.Request) {
			if r.Method != http.MethodGet {
				http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
				return
			}
			query := r.URL.Path[len("/images/"):]
			if query == "" {
				http.Error(w, "Query parameter is required", http.StatusBadRequest)
				return
			}
			photos, err := pexels.SearchPhoto(r.Context(), query)
			if err != nil {
				http.Error(w, err.Error(), http.StatusInternalServerError)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(photos)
		}},
	}

	authRoutes := []route{
		{"/auth/google", auth.HandleGoogleLogin},
		{"/auth/google/callback", auth.HandleGoogleCallback},
		{"/auth/user", func(w http.ResponseWriter, r *http.Request) {
			auth.AuthMiddleware(http.HandlerFunc(auth.HandleGetCurrentUser)).ServeHTTP(w, r)
		}},
		{"/auth/logout", auth.HandleLogout},
	}

	// --- Register all grouped routes ---
	// mountRoutes(mux, notesRoutes) // Removed, now explicitly registered above

	// Wrap planner routes with OptionalAuthMiddleware
	plannerMux := http.NewServeMux()
	mountRoutes(plannerMux, plannerRoutes)
	mux.Handle("/planner", auth.OptionalAuthMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		plannerMux.ServeHTTP(w, r)
	})))
	mux.Handle("/planner/", auth.OptionalAuthMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		plannerMux.ServeHTTP(w, r)
	})))
	mux.Handle("/api/planner", auth.OptionalAuthMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		plannerMux.ServeHTTP(w, r)
	})))
	mux.Handle("/api/planner/", auth.OptionalAuthMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		plannerMux.ServeHTTP(w, r)
	})))

	mountRoutes(mux, imageRoutes)
	mountRoutes(mux, authRoutes)

	// Register strands routes - using direct registration instead of mountRoutes
	// because we need to use auth middleware which returns http.Handler not http.HandlerFunc
	mux.Handle("/strands", auth.AuthMiddleware(http.HandlerFunc(strands.HandleStrandsRequest)))
	mux.Handle("/api/strands", auth.AuthMiddleware(http.HandlerFunc(strands.HandleStrandsRequest)))

	mux.Handle("/strands/", auth.AuthMiddleware(http.HandlerFunc(strands.HandleStrandsRequest)))
	mux.Handle("/api/strands/", auth.AuthMiddleware(http.HandlerFunc(strands.HandleStrandsRequest)))

	// Register LLM profiles routes with authentication (both /api and non-api versions)
	llmProfilesHandler := auth.AuthMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodGet:
			llm_profiles.HandleGetLLMProfiles(w, r)
		case http.MethodPost:
			llm_profiles.HandleCreateLLMProfile(w, r)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	}))

	mux.Handle("/api/llm-profiles", llmProfilesHandler)
	mux.Handle("/llm-profiles", llmProfilesHandler)

	llmProfilesWithIDHandler := auth.AuthMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Extract the ID from the URL
		path := r.URL.Path
		prefix := "/api/llm-profiles/"
		if !strings.HasPrefix(path, prefix) {
			prefix = "/llm-profiles/"
		}

		// Remove prefix and get the remaining path
		remaining := strings.TrimPrefix(path, prefix)
		parts := strings.Split(remaining, "/")

		// Check if we have enough parts
		if len(parts) < 1 || parts[0] == "" {
			http.Error(w, "Invalid URL", http.StatusBadRequest)
			return
		}

		id := parts[0]

		// Check if this is a set-default request
		if len(parts) >= 2 && parts[1] == "set-default" {
			if r.Method != http.MethodPut {
				http.Error(w, "Method not allowed for set-default operation", http.StatusMethodNotAllowed)
				return
			}
			llm_profiles.HandleSetDefaultLLMProfile(w, r, id)
			return
		}

		// Check if this is a test-stored-connection request
		if len(parts) >= 2 && parts[1] == "test-stored-connection" {
			if r.Method != http.MethodPost {
				http.Error(w, "Method not allowed for test-stored-connection operation", http.StatusMethodNotAllowed)
				return
			}
			llm_profiles.HandleTestStoredLLMConnection(w, r, id)
			return
		}

		// Handle regular CRUD operations
		switch r.Method {
		case http.MethodGet:
			llm_profiles.HandleGetLLMProfile(w, r, id)
		case http.MethodPut:
			llm_profiles.HandleUpdateLLMProfile(w, r, id)
		case http.MethodDelete:
			llm_profiles.HandleDeleteLLMProfile(w, r, id)
		default:
			http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		}
	}))

	mux.Handle("/api/llm-profiles/", llmProfilesWithIDHandler)
	mux.Handle("/llm-profiles/", llmProfilesWithIDHandler)

	testConnectionHandler := auth.AuthMiddleware(http.HandlerFunc(llm_profiles.HandleTestLLMConnection))
	mux.Handle("/api/llm-profiles/test-connection", testConnectionHandler)
	mux.Handle("/llm-profiles/test-connection", testConnectionHandler)

	// Add models endpoint
	modelsHandler := auth.AuthMiddleware(http.HandlerFunc(llm_profiles.HandleListAvailableModels))
	mux.Handle("/api/llm-profiles/models", modelsHandler)
	mux.Handle("/llm-profiles/models", modelsHandler)

	// We'll modify the existing llmProfilesWithIDHandler to handle test-stored-connection
	// instead of creating new handlers that conflict with existing ones

	// WhatsApp webhook doesn't require authentication
	mux.HandleFunc("/strands/whatsapp", strands.HandleWhatsAppWebhook)
	mux.HandleFunc("/api/strands/whatsapp", strands.HandleWhatsAppWebhook)

	// Register authentication routes

	// Wrap existing mux with optional authentication middleware
	protectedMux := auth.OptionalAuthMiddleware(mux)

	// Create handler chain with CORS middleware
	handler := CORS(protectedMux)

	log.Println("Starting server on :8080")
	if err := http.ListenAndServe(":8080", handler); err != nil {
		log.Fatalf("Server failed: %s", err)
	}
}
