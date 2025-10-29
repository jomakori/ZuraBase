package tests

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"zurabase/api/llm_profiles"
	"zurabase/auth"
	"zurabase/models"
)

func TestLLMProfilesAPI(t *testing.T) {
	// Set up test environment
	client, err := mongo.Connect(context.Background(), options.Client().ApplyURI(os.Getenv("MONGO_URI")))
	if err != nil {
		t.Skipf("MongoDB not available: %v", err)
	}
	defer client.Disconnect(context.Background())

	// Initialize required packages
	err = models.InitializeLLMProfiles(client, "test_zurabase")
	if err != nil {
		t.Fatalf("Failed to initialize LLM profiles: %v", err)
	}

	auth.Initialize(client, "test_zurabase")

	// Clean up any existing test data
	collection := client.Database("test_zurabase").Collection("llm_profiles")
	_, _ = collection.DeleteMany(context.Background(), bson.M{"user_id": "test-api-user"})

	// Create test server
	mux := http.NewServeMux()
	llm_profiles.RegisterRoutes(mux)

	// Mock auth middleware for testing
	testHandler := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Add test user to context
			ctx := context.WithValue(r.Context(), "user_id", "test-api-user")
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}

	server := httptest.NewServer(testHandler(mux))
	defer server.Close()

	clientHTTP := &http.Client{
		Timeout: 30 * time.Second,
	}

	t.Run("Create LLM Profile", func(t *testing.T) {
		profileData := map[string]interface{}{
			"name":       "Test API Profile",
			"server_url": "https://api.test.com",
			"api_key":    "test-api-key-123",
			"is_default": true,
		}

		jsonData, _ := json.Marshal(profileData)
		req, err := http.NewRequest("POST", server.URL+"/api/llm-profiles", bytes.NewBuffer(jsonData))
		if err != nil {
			t.Fatalf("Failed to create request: %v", err)
		}
		req.Header.Set("Content-Type", "application/json")

		resp, err := clientHTTP.Do(req)
		if err != nil {
			t.Fatalf("Request failed: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusCreated {
			t.Errorf("Expected status 201, got %d", resp.StatusCode)
		}

		var response map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&response)
		if err != nil {
			t.Fatalf("Failed to decode response: %v", err)
		}

		if response["profile"] == nil {
			t.Error("Expected profile in response")
		}

		profile := response["profile"].(map[string]interface{})
		if profile["name"] != "Test API Profile" {
			t.Errorf("Profile name mismatch, got %s, want %s", profile["name"], "Test API Profile")
		}
	})

	t.Run("Get LLM Profiles", func(t *testing.T) {
		req, err := http.NewRequest("GET", server.URL+"/api/llm-profiles", nil)
		if err != nil {
			t.Fatalf("Failed to create request: %v", err)
		}

		resp, err := clientHTTP.Do(req)
		if err != nil {
			t.Fatalf("Request failed: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			t.Errorf("Expected status 200, got %d", resp.StatusCode)
		}

		var response map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&response)
		if err != nil {
			t.Fatalf("Failed to decode response: %v", err)
		}

		if response["profiles"] == nil {
			t.Error("Expected profiles in response")
		}

		profiles := response["profiles"].([]interface{})
		if len(profiles) == 0 {
			t.Error("Expected at least one profile")
		}
	})

	t.Run("Update LLM Profile", func(t *testing.T) {
		// First, get a profile to update
		profiles, err := models.GetLLMProfilesByUser(context.Background(), "test-api-user")
		if err != nil || len(profiles) == 0 {
			t.Fatalf("No profiles found to update")
		}

		profileID := profiles[0].ID

		updateData := map[string]interface{}{
			"name":       "Updated API Profile",
			"server_url": "https://api.updated.com",
			"api_key":    "updated-api-key",
			"is_default": false,
		}

		jsonData, _ := json.Marshal(updateData)
		req, err := http.NewRequest("PUT", server.URL+"/api/llm-profiles/"+profileID, bytes.NewBuffer(jsonData))
		if err != nil {
			t.Fatalf("Failed to create request: %v", err)
		}
		req.Header.Set("Content-Type", "application/json")

		resp, err := clientHTTP.Do(req)
		if err != nil {
			t.Fatalf("Request failed: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			t.Errorf("Expected status 200, got %d", resp.StatusCode)
		}

		var response map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&response)
		if err != nil {
			t.Fatalf("Failed to decode response: %v", err)
		}

		profile := response["profile"].(map[string]interface{})
		if profile["name"] != "Updated API Profile" {
			t.Errorf("Profile name mismatch after update, got %s, want %s", profile["name"], "Updated API Profile")
		}
	})

	t.Run("Set Default LLM Profile", func(t *testing.T) {
		// Get a profile to set as default
		profiles, err := models.GetLLMProfilesByUser(context.Background(), "test-api-user")
		if err != nil || len(profiles) == 0 {
			t.Fatalf("No profiles found")
		}

		profileID := profiles[0].ID

		req, err := http.NewRequest("PUT", server.URL+"/api/llm-profiles/"+profileID+"/set-default", nil)
		if err != nil {
			t.Fatalf("Failed to create request: %v", err)
		}

		resp, err := clientHTTP.Do(req)
		if err != nil {
			t.Fatalf("Request failed: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			t.Errorf("Expected status 200, got %d", resp.StatusCode)
		}

		var response map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&response)
		if err != nil {
			t.Fatalf("Failed to decode response: %v", err)
		}

		profile := response["profile"].(map[string]interface{})
		if !profile["is_default"].(bool) {
			t.Error("Profile should be marked as default after set-default call")
		}
	})

	t.Run("Test LLM Connection", func(t *testing.T) {
		testData := map[string]interface{}{
			"server_url": "https://api.openai.com",
			"api_key":    "test-api-key-connection",
		}

		jsonData, _ := json.Marshal(testData)
		req, err := http.NewRequest("POST", server.URL+"/api/llm-profiles/test-connection", bytes.NewBuffer(jsonData))
		if err != nil {
			t.Fatalf("Failed to create request: %v", err)
		}
		req.Header.Set("Content-Type", "application/json")

		resp, err := clientHTTP.Do(req)
		if err != nil {
			t.Fatalf("Request failed: %v", err)
		}
		defer resp.Body.Close()

		// Connection test might fail (since we're using a fake API key), but should return a proper response
		if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusBadRequest {
			t.Errorf("Expected status 200 or 400, got %d", resp.StatusCode)
		}

		var response map[string]interface{}
		err = json.NewDecoder(resp.Body).Decode(&response)
		if err != nil {
			t.Fatalf("Failed to decode response: %v", err)
		}

		if response["success"] == nil {
			t.Error("Expected success field in response")
		}
	})

	t.Run("Delete LLM Profile", func(t *testing.T) {
		// Get a profile to delete
		profiles, err := models.GetLLMProfilesByUser(context.Background(), "test-api-user")
		if err != nil || len(profiles) == 0 {
			t.Fatalf("No profiles found to delete")
		}

		profileID := profiles[0].ID

		req, err := http.NewRequest("DELETE", server.URL+"/api/llm-profiles/"+profileID, nil)
		if err != nil {
			t.Fatalf("Failed to create request: %v", err)
		}

		resp, err := clientHTTP.Do(req)
		if err != nil {
			t.Fatalf("Request failed: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusNoContent {
			t.Errorf("Expected status 204, got %d", resp.StatusCode)
		}

		// Verify the profile was actually deleted
		_, err = models.GetLLMProfile(context.Background(), profileID)
		if err == nil {
			t.Error("Profile should have been deleted")
		}
	})

	t.Run("Validation Tests", func(t *testing.T) {
		// Test missing name
		invalidData := map[string]interface{}{
			"server_url": "https://api.test.com",
			"api_key":    "test-key",
			"is_default": false,
		}

		jsonData, _ := json.Marshal(invalidData)
		req, err := http.NewRequest("POST", server.URL+"/api/llm-profiles", bytes.NewBuffer(jsonData))
		if err != nil {
			t.Fatalf("Failed to create request: %v", err)
		}
		req.Header.Set("Content-Type", "application/json")

		resp, err := clientHTTP.Do(req)
		if err != nil {
			t.Fatalf("Request failed: %v", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusBadRequest {
			t.Errorf("Expected status 400 for missing name, got %d", resp.StatusCode)
		}

		// Test missing API key
		invalidData2 := map[string]interface{}{
			"name":       "Test Profile",
			"server_url": "https://api.test.com",
			"is_default": false,
		}

		jsonData2, _ := json.Marshal(invalidData2)
		req2, err := http.NewRequest("POST", server.URL+"/api/llm-profiles", bytes.NewBuffer(jsonData2))
		if err != nil {
			t.Fatalf("Failed to create request: %v", err)
		}
		req2.Header.Set("Content-Type", "application/json")

		resp2, err := clientHTTP.Do(req2)
		if err != nil {
			t.Fatalf("Request failed: %v", err)
		}
		defer resp2.Body.Close()

		if resp2.StatusCode != http.StatusBadRequest {
			t.Errorf("Expected status 400 for missing API key, got %d", resp2.StatusCode)
		}
	})
}
