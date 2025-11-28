package tests

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"zurabase/internal/server"

	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Ensure all required environment variables are loaded before tests
func init() {
	// Set test environment
	os.Setenv("ENVIRONMENT", "test")

	// Use Doppler environment variables - don't override them
	requiredVars := []string{"MONGO_URI", "MONGO_DB_NAME", "LLM_ENCRYPTION_KEY", "JWT_SECRET", "API_ENDPOINT"}
	for _, env := range requiredVars {
		if os.Getenv(env) == "" {
			panic("Missing required environment variable: " + env + ". Ensure Doppler dev_testing config is loaded.")
		}
	}
}

// Doppler-only environment variable utilities

// GetAPIEndpoint returns the API endpoint from Doppler
func GetAPIEndpoint() string {
	v := os.Getenv("API_ENDPOINT")
	if v == "" {
		panic("API_ENDPOINT not set. Ensure Doppler dev_testing config is loaded before running tests.")
	}
	return v
}

// GetMongoURI returns the MongoDB URI from Doppler
func GetMongoURI() string {
	v := os.Getenv("MONGO_URI")
	if v == "" {
		panic("MONGO_URI not set. Ensure Doppler dev_testing config is loaded before running tests.")
	}
	return v
}

// GetLLMEncryptionKey returns the LLM encryption key from Doppler
func GetLLMEncryptionKey() string {
	v := os.Getenv("LLM_ENCRYPTION_KEY")
	if v == "" {
		panic("LLM_ENCRYPTION_KEY not set. Ensure Doppler dev_testing config is loaded before running tests.")
	}
	return v
}

// GetJWTSecret returns the JWT secret from Doppler
func GetJWTSecret() string {
	v := os.Getenv("JWT_SECRET")
	if v == "" {
		panic("JWT_SECRET not set. Ensure Doppler dev_testing config is loaded before running tests.")
	}
	return v
}

// GetMongoDBName returns the MongoDB database name from Doppler
func GetMongoDBName() string {
	v := os.Getenv("MONGO_DB_NAME")
	if v == "" {
		panic("MONGO_DB_NAME not set. Ensure Doppler dev_testing config is loaded before running tests.")
	}
	return v
}

// Common test utilities

// SetupTestMongoClient creates a MongoDB client for testing
func SetupTestMongoClient(ctx context.Context, t *testing.T) *mongo.Client {
	client, err := mongo.Connect(ctx, options.Client().ApplyURI(GetMongoURI()))
	if err != nil {
		t.Skipf("MongoDB not available: %v", err)
		return nil
	}
	return client
}

// SetupTestDatabase creates a test database with proper initialization
func SetupTestDatabase(ctx context.Context, t *testing.T, client *mongo.Client, dbName string) {
	// Clean up any existing test data
	defer func() {
		if client != nil {
			client.Database(dbName).Drop(ctx)
		}
	}()
}

// Helper to perform GET request using test router
func DoGetRequest[T any](ctx context.Context, t *testing.T, path string) *T {
	router := server.SetupTestRouter()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, path, nil)
	if err != nil {
		t.Fatalf("failed to create GET request: %v", err)
	}
	// Add test authentication header for authenticated endpoints
	if RequiresAuth(path) {
		req.Header.Set("Authorization", "Bearer test-token")
	}
	req.Header.Set("Origin", "http://localhost:5173")

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("unexpected response status: %d - %s", rec.Code, rec.Body.String())
	}
	var result T
	if err := json.NewDecoder(rec.Body).Decode(&result); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	return &result
}

// Helper to perform POST request with JSON body using test router
func DoPostRequest[T any, V any](ctx context.Context, t *testing.T, path string, body V) *T {
	router := server.SetupTestRouter()

	jsonBytes, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("failed to marshal body: %v", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, path, bytes.NewReader(jsonBytes))
	if err != nil {
		t.Fatalf("failed to create POST request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	// Add test authentication header for authenticated endpoints
	if RequiresAuth(path) {
		req.Header.Set("Authorization", "Bearer test-token")
	}
	req.Header.Set("Origin", "http://localhost:5173")

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("unexpected response status: %d - %s", rec.Code, rec.Body.String())
	}
	var result T
	if err := json.NewDecoder(rec.Body).Decode(&result); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	return &result
}

// Helper function to determine if a path requires authentication
func RequiresAuth(path string) bool {
	// Expanded list of paths that require authentication for database-dependent routes
	authPaths := []string{
		"/strands",
		"/llm-profiles",
		"/api/strands",
		"/api/llm-profiles",
		"/api/note",
		"/api/notes",
		"/api/planner",
		"/planner",
	}
	for _, authPath := range authPaths {
		if strings.HasPrefix(path, authPath) {
			return true
		}
	}
	return false
}

// SkipIfNoAPIEndpoint skips the test if API_ENDPOINT is not configured
func SkipIfNoAPIEndpoint(t *testing.T) {
	if GetAPIEndpoint() == "" {
		t.Skip("Skipping test: API_ENDPOINT not set")
	}
}

// SkipIfNoLLMEncryptionKey skips the test if LLM_ENCRYPTION_KEY is not configured
func SkipIfNoLLMEncryptionKey(t *testing.T) {
	if GetLLMEncryptionKey() == "" {
		t.Skip("Skipping test: LLM_ENCRYPTION_KEY not set. Ensure Doppler dev_testing config is loaded.")
	}
}
