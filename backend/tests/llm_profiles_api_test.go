package tests

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"go.mongodb.org/mongo-driver/bson"

	"zurabase/internal/auth"
	"zurabase/internal/models"
	"zurabase/internal/server"
)

// setupAuth creates a test JWT token for a given user ID and email.
func setupAuth(t *testing.T, userID, email string) string {
	token, err := auth.GenerateToken(userID, email)
	if err != nil {
		t.Fatalf("Failed to generate auth token: %v", err)
	}
	return token
}

func TestLLMProfile_API_Create(t *testing.T) {
	// Set up test environment
	client := SetupTestMongoClient(context.Background(), t)
	if client == nil {
		return
	}
	defer client.Disconnect(context.Background())

	// Initialize required packages
	err := models.InitializeLLMProfiles(client, "test_zurabase")
	if err != nil {
		t.Fatalf("Failed to initialize LLM profiles: %v", err)
	}

	auth.Initialize(client, "test_zurabase")
	auth.ReloadJWTSecret() // Ensure JWT secret is synchronized

	// Clean up any existing test data
	collection := client.Database("test_zurabase").Collection("llm_profiles")
	_, _ = collection.DeleteMany(context.Background(), bson.M{"user_id": "test-api-user"})

	// Generate a test token for authentication
	testUserToken := setupAuth(t, "test-api-user", "test@example.com")

	// Set up test router
	router := server.SetupTestRouter()

	profileData := map[string]interface{}{
		"name":       "Test API Profile",
		"server_url": "https://api.test.com",
		"api_key":    "test-api-key-123",
		"is_default": true,
		"model":      "gpt-3.5-turbo",
	}

	jsonData, _ := json.Marshal(profileData)
	req, err := http.NewRequest("POST", "/api/llm-profiles", bytes.NewBuffer(jsonData))
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+testUserToken)

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusCreated {
		t.Errorf("Expected status 201, got %d. Response: %s", rec.Code, rec.Body.String())
	}

	var response map[string]interface{}
	err = json.NewDecoder(rec.Body).Decode(&response)
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
}

func TestLLMProfile_API_Get(t *testing.T) {
	// Set up test environment
	client := SetupTestMongoClient(context.Background(), t)
	if client == nil {
		return
	}
	defer client.Disconnect(context.Background())

	// Initialize required packages
	err := models.InitializeLLMProfiles(client, "test_zurabase")
	if err != nil {
		t.Fatalf("Failed to initialize LLM profiles: %v", err)
	}

	auth.Initialize(client, "test_zurabase")
	auth.ReloadJWTSecret()

	// Clean up any existing test data
	collection := client.Database("test_zurabase").Collection("llm_profiles")
	_, _ = collection.DeleteMany(context.Background(), bson.M{"user_id": "test-api-user"})

	// Generate a test token for authentication
	testUserToken := setupAuth(t, "test-api-user", "test@example.com")

	// Set up test router
	router := server.SetupTestRouter()

	// First create a profile to get
	profileData := map[string]interface{}{
		"name":       "Test Profile for Get",
		"server_url": "https://api.test.com",
		"api_key":    "test-api-key-get",
		"is_default": true,
		"model":      "gpt-3.5-turbo",
	}

	jsonData, _ := json.Marshal(profileData)
	createReq, err := http.NewRequest("POST", "/api/llm-profiles", bytes.NewBuffer(jsonData))
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}
	createReq.Header.Set("Content-Type", "application/json")
	createReq.Header.Set("Authorization", "Bearer "+testUserToken)

	createRec := httptest.NewRecorder()
	router.ServeHTTP(createRec, createReq)

	if createRec.Code != http.StatusCreated {
		t.Fatalf("Failed to create profile for get test, status: %d, response: %s", createRec.Code, createRec.Body.String())
	}

	// Now get the profiles
	getReq, err := http.NewRequest("GET", "/api/llm-profiles", nil)
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}
	getReq.Header.Set("Authorization", "Bearer "+testUserToken)

	getRec := httptest.NewRecorder()
	router.ServeHTTP(getRec, getReq)

	if getRec.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d. Response: %s", getRec.Code, getRec.Body.String())
	}

	var response map[string]interface{}
	err = json.NewDecoder(getRec.Body).Decode(&response)
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
}

func TestLLMProfile_API_Update(t *testing.T) {
	// Set up test environment
	client := SetupTestMongoClient(context.Background(), t)
	if client == nil {
		return
	}
	defer client.Disconnect(context.Background())

	// Initialize required packages
	err := models.InitializeLLMProfiles(client, "test_zurabase")
	if err != nil {
		t.Fatalf("Failed to initialize LLM profiles: %v", err)
	}

	auth.Initialize(client, "test_zurabase")
	auth.ReloadJWTSecret()

	// Clean up any existing test data
	collection := client.Database("test_zurabase").Collection("llm_profiles")
	_, _ = collection.DeleteMany(context.Background(), bson.M{"user_id": "test-api-user"})

	// Generate a test token for authentication
	testUserToken := setupAuth(t, "test-api-user", "test@example.com")

	// Set up test router
	router := server.SetupTestRouter()

	// First create a profile to update
	profileData := map[string]interface{}{
		"name":       "Test Profile for Update",
		"server_url": "https://api.test.com",
		"api_key":    "test-api-key-update",
		"is_default": true,
		"model":      "gpt-3.5-turbo",
	}

	jsonData, _ := json.Marshal(profileData)
	createReq, err := http.NewRequest("POST", "/api/llm-profiles", bytes.NewBuffer(jsonData))
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}
	createReq.Header.Set("Content-Type", "application/json")
	createReq.Header.Set("Authorization", "Bearer "+testUserToken)

	createRec := httptest.NewRecorder()
	router.ServeHTTP(createRec, createReq)

	if createRec.Code != http.StatusCreated {
		t.Fatalf("Failed to create profile for update test, status: %d, response: %s", createRec.Code, createRec.Body.String())
	}

	var createResponse map[string]interface{}
	err = json.NewDecoder(createRec.Body).Decode(&createResponse)
	if err != nil {
		t.Fatalf("Failed to decode create response: %v", err)
	}

	profile := createResponse["profile"].(map[string]interface{})
	profileID := profile["id"].(string)

	// Now update the profile
	updateData := map[string]interface{}{
		"name":       "Updated API Profile",
		"server_url": "https://api.updated.com",
		"api_key":    "updated-api-key",
		"model":      "gpt-4",
		"is_default": false,
	}

	updateJsonData, _ := json.Marshal(updateData)
	updateReq, err := http.NewRequest("PUT", "/api/llm-profiles/"+profileID, bytes.NewBuffer(updateJsonData))
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}
	updateReq.Header.Set("Content-Type", "application/json")
	updateReq.Header.Set("Authorization", "Bearer "+testUserToken)

	updateRec := httptest.NewRecorder()
	router.ServeHTTP(updateRec, updateReq)

	if updateRec.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d. Response: %s", updateRec.Code, updateRec.Body.String())
	}

	var updateResponse map[string]interface{}
	err = json.NewDecoder(updateRec.Body).Decode(&updateResponse)
	if err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	updatedProfile := updateResponse["profile"].(map[string]interface{})
	if updatedProfile["name"] != "Updated API Profile" {
		t.Errorf("Profile name mismatch after update, got %s, want %s", updatedProfile["name"], "Updated API Profile")
	}
}

func TestLLMProfile_API_SetDefault(t *testing.T) {
	// Set up test environment
	client := SetupTestMongoClient(context.Background(), t)
	if client == nil {
		return
	}
	defer client.Disconnect(context.Background())

	// Initialize required packages
	err := models.InitializeLLMProfiles(client, "test_zurabase")
	if err != nil {
		t.Fatalf("Failed to initialize LLM profiles: %v", err)
	}

	auth.Initialize(client, "test_zurabase")
	auth.ReloadJWTSecret()

	// Clean up any existing test data
	collection := client.Database("test_zurabase").Collection("llm_profiles")
	_, _ = collection.DeleteMany(context.Background(), bson.M{"user_id": "test-api-user"})

	// Generate a test token for authentication
	testUserToken := setupAuth(t, "test-api-user", "test@example.com")

	// Set up test router
	router := server.SetupTestRouter()

	// First create a profile to set as default
	profileData := map[string]interface{}{
		"name":       "Test Profile for SetDefault",
		"server_url": "https://api.test.com",
		"api_key":    "test-api-key-setdefault",
		"is_default": false,
		"model":      "gpt-3.5-turbo",
	}

	jsonData, _ := json.Marshal(profileData)
	createReq, err := http.NewRequest("POST", "/api/llm-profiles", bytes.NewBuffer(jsonData))
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}
	createReq.Header.Set("Content-Type", "application/json")
	createReq.Header.Set("Authorization", "Bearer "+testUserToken)

	createRec := httptest.NewRecorder()
	router.ServeHTTP(createRec, createReq)

	if createRec.Code != http.StatusCreated {
		t.Fatalf("Failed to create profile for set-default test, status: %d, response: %s", createRec.Code, createRec.Body.String())
	}

	var createResponse map[string]interface{}
	err = json.NewDecoder(createRec.Body).Decode(&createResponse)
	if err != nil {
		t.Fatalf("Failed to decode create response: %v", err)
	}

	profile := createResponse["profile"].(map[string]interface{})
	profileID := profile["id"].(string)

	// Set the profile as default
	setDefaultReq, err := http.NewRequest("PUT", "/api/llm-profiles/"+profileID+"/set-default", nil)
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}
	setDefaultReq.Header.Set("Authorization", "Bearer "+testUserToken)

	setDefaultRec := httptest.NewRecorder()
	router.ServeHTTP(setDefaultRec, setDefaultReq)

	if setDefaultRec.Code != http.StatusOK {
		t.Errorf("Expected status 200, got %d. Response: %s", setDefaultRec.Code, setDefaultRec.Body.String())
	}

	var response map[string]interface{}
	err = json.NewDecoder(setDefaultRec.Body).Decode(&response)
	if err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	profileResponse := response["profile"].(map[string]interface{})
	if !profileResponse["is_default"].(bool) {
		t.Error("Profile should be marked as default after set-default call")
	}
}

func TestLLMProfile_API_TestConnection(t *testing.T) {
	// Set up test environment
	client := SetupTestMongoClient(context.Background(), t)
	if client == nil {
		return
	}
	defer client.Disconnect(context.Background())

	// Initialize required packages
	err := models.InitializeLLMProfiles(client, "test_zurabase")
	if err != nil {
		t.Fatalf("Failed to initialize LLM profiles: %v", err)
	}

	auth.Initialize(client, "test_zurabase")
	auth.ReloadJWTSecret()

	// Generate a test token for authentication
	testUserToken := setupAuth(t, "test-api-user", "test@example.com")

	// Set up test router
	router := server.SetupTestRouter()

	testData := map[string]interface{}{
		"server_url": "https://api.openai.com",
		"api_key":    "test-api-key-connection",
		"model":      "gpt-3.5-turbo",
	}

	jsonData, _ := json.Marshal(testData)
	req, err := http.NewRequest("POST", "/api/llm-profiles/test-connection", bytes.NewBuffer(jsonData))
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+testUserToken)

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	// Connection test might fail (since we're using a fake API key), but should return a proper response
	if rec.Code != http.StatusOK && rec.Code != http.StatusBadRequest {
		t.Errorf("Expected status 200 or 400, got %d. Response: %s", rec.Code, rec.Body.String())
	}

	var response map[string]interface{}
	err = json.NewDecoder(rec.Body).Decode(&response)
	if err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if response["success"] == nil {
		t.Error("Expected success field in response")
	}
}

func TestLLMProfile_API_Delete(t *testing.T) {
	// Set up test environment
	client := SetupTestMongoClient(context.Background(), t)
	if client == nil {
		return
	}
	defer client.Disconnect(context.Background())

	// Initialize required packages
	err := models.InitializeLLMProfiles(client, "test_zurabase")
	if err != nil {
		t.Fatalf("Failed to initialize LLM profiles: %v", err)
	}

	auth.Initialize(client, "test_zurabase")
	auth.ReloadJWTSecret()

	// Clean up any existing test data
	collection := client.Database("test_zurabase").Collection("llm_profiles")
	_, _ = collection.DeleteMany(context.Background(), bson.M{"user_id": "test-api-user"})

	// Generate a test token for authentication
	testUserToken := setupAuth(t, "test-api-user", "test@example.com")

	// Set up test router
	router := server.SetupTestRouter()

	// First create a profile to delete
	profileData := map[string]interface{}{
		"name":       "Test Profile for Delete",
		"server_url": "https://api.test.com",
		"api_key":    "test-api-key-delete",
		"is_default": true,
		"model":      "gpt-3.5-turbo",
	}

	jsonData, _ := json.Marshal(profileData)
	createReq, err := http.NewRequest("POST", "/api/llm-profiles", bytes.NewBuffer(jsonData))
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}
	createReq.Header.Set("Content-Type", "application/json")
	createReq.Header.Set("Authorization", "Bearer "+testUserToken)

	createRec := httptest.NewRecorder()
	router.ServeHTTP(createRec, createReq)

	if createRec.Code != http.StatusCreated {
		t.Fatalf("Failed to create profile for delete test, status: %d, response: %s", createRec.Code, createRec.Body.String())
	}

	var createResponse map[string]interface{}
	err = json.NewDecoder(createRec.Body).Decode(&createResponse)
	if err != nil {
		t.Fatalf("Failed to decode create response: %v", err)
	}

	profile := createResponse["profile"].(map[string]interface{})
	profileID := profile["id"].(string)

	// Now delete the profile
	deleteReq, err := http.NewRequest("DELETE", "/api/llm-profiles/"+profileID, nil)
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}
	deleteReq.Header.Set("Authorization", "Bearer "+testUserToken)

	deleteRec := httptest.NewRecorder()
	router.ServeHTTP(deleteRec, deleteReq)

	if deleteRec.Code != http.StatusNoContent {
		t.Errorf("Expected status 204, got %d. Response: %s", deleteRec.Code, deleteRec.Body.String())
	}

	// Verify the profile was actually deleted by trying to get it again
	getAfterDeleteReq, err := http.NewRequest("GET", "/api/llm-profiles/"+profileID, nil)
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}
	getAfterDeleteReq.Header.Set("Authorization", "Bearer "+testUserToken)

	getAfterDeleteRec := httptest.NewRecorder()
	router.ServeHTTP(getAfterDeleteRec, getAfterDeleteReq)

	// Should get 404 after deletion
	if getAfterDeleteRec.Code != http.StatusNotFound {
		t.Errorf("Expected status 404 after deletion, got %d. Response: %s", getAfterDeleteRec.Code, getAfterDeleteRec.Body.String())
	}
}

func TestLLMProfile_API_Validation(t *testing.T) {
	// Set up test environment
	client := SetupTestMongoClient(context.Background(), t)
	if client == nil {
		return
	}
	defer client.Disconnect(context.Background())

	// Initialize required packages
	err := models.InitializeLLMProfiles(client, "test_zurabase")
	if err != nil {
		t.Fatalf("Failed to initialize LLM profiles: %v", err)
	}

	auth.Initialize(client, "test_zurabase")
	auth.ReloadJWTSecret()

	// Generate a test token for authentication
	testUserToken := setupAuth(t, "test-api-user", "test@example.com")

	// Set up test router
	router := server.SetupTestRouter()

	// Test missing name
	invalidData := map[string]interface{}{
		"server_url": "https://api.test.com",
		"api_key":    "test-key",
		"is_default": false,
		"model":      "gpt-3.5-turbo",
	}

	jsonData, _ := json.Marshal(invalidData)
	req, err := http.NewRequest("POST", "/api/llm-profiles", bytes.NewBuffer(jsonData))
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+testUserToken)

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400 for missing name, got %d. Response: %s", rec.Code, rec.Body.String())
	}

	// Test missing API key
	invalidData2 := map[string]interface{}{
		"name":       "Test Profile",
		"server_url": "https://api.test.com",
		"is_default": false,
		"model":      "gpt-3.5-turbo",
	}

	jsonData2, _ := json.Marshal(invalidData2)
	req2, err := http.NewRequest("POST", "/api/llm-profiles", bytes.NewBuffer(jsonData2))
	if err != nil {
		t.Fatalf("Failed to create request: %v", err)
	}
	req2.Header.Set("Content-Type", "application/json")
	req2.Header.Set("Authorization", "Bearer "+testUserToken)

	rec2 := httptest.NewRecorder()
	router.ServeHTTP(rec2, req2)

	if rec2.Code != http.StatusBadRequest {
		t.Errorf("Expected status 400 for missing API key, got %d. Response: %s", rec2.Code, rec2.Body.String())
	}
}
