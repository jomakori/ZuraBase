package tests

import (
	"context"
	"crypto/rand"
	_ "encoding/base64"
	"testing"
	"time"

	"go.mongodb.org/mongo-driver/bson"

	"zurabase/internal/models"
)

func TestLLMProfile_Encryption(t *testing.T) {
	// Set up a test encryption key
	key := make([]byte, 32)
	_, err := rand.Read(key)
	if err != nil {
		t.Fatalf("Failed to generate test key: %v", err)
	}
	SkipIfNoLLMEncryptionKey(t)

	// Initialize models with test database
	client := SetupTestMongoClient(context.Background(), t)
	if client == nil {
		return
	}
	defer client.Disconnect(context.Background())

	err = models.InitializeLLMProfiles(client, "test_zurabase")
	if err != nil {
		t.Fatalf("Failed to initialize LLM profiles: %v", err)
	}

	// Test encryption and decryption
	profile := &models.LLMProfile{
		ID:        "test-id",
		UserID:    "test-user",
		Name:      "Test Profile",
		ServerURL: "https://api.test.com",
		APIKey:    "test-api-key-12345",
		IsDefault: false,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// Test encryption
	err = profile.Encrypt()
	if err != nil {
		t.Fatalf("Encryption failed: %v", err)
	}

	// Verify the API key is encrypted (not the original value)
	if profile.APIKey == "test-api-key-12345" {
		t.Error("API key was not encrypted")
	}

	// Test decryption
	err = profile.Decrypt()
	if err != nil {
		t.Fatalf("Decryption failed: %v", err)
	}

	// Verify the API key is back to original
	if profile.APIKey != "test-api-key-12345" {
		t.Errorf("Decryption failed, got %s, want %s", profile.APIKey, "test-api-key-12345")
	}
}

func TestLLMProfile_CRUD(t *testing.T) {
	// Set up test environment
	client := SetupTestMongoClient(context.Background(), t)
	if client == nil {
		return
	}
	defer client.Disconnect(context.Background())

	err := models.InitializeLLMProfiles(client, "test_zurabase")
	if err != nil {
		t.Fatalf("Failed to initialize LLM profiles: %v", err)
	}

	ctx := context.Background()

	// Clean up any existing test data
	collection := client.Database("test_zurabase").Collection("llm_profiles")
	_, _ = collection.DeleteMany(ctx, bson.M{"user_id": "test-user-crud"})

	// Test Create
	profile := &models.LLMProfile{
		ID:        "test-crud-id",
		UserID:    "test-user-crud",
		Name:      "Test CRUD Profile",
		ServerURL: "https://api.test.com",
		APIKey:    "test-api-key-crud",
		Model:     "gpt-4",
		IsDefault: false,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	savedProfile, err := models.SaveLLMProfile(ctx, profile)
	if err != nil {
		t.Fatalf("Failed to save profile: %v", err)
	}

	if savedProfile.ID != profile.ID {
		t.Errorf("Saved profile ID mismatch, got %s, want %s", savedProfile.ID, profile.ID)
	}

	// Test Read
	retrievedProfile, err := models.GetLLMProfile(ctx, profile.ID)
	if err != nil {
		t.Fatalf("Failed to get profile: %v", err)
	}

	if retrievedProfile.Name != profile.Name {
		t.Errorf("Retrieved profile name mismatch, got %s, want %s", retrievedProfile.Name, profile.Name)
	}

	// Test Update
	profile.Name = "Updated Test Profile"
	profile.APIKey = "updated-api-key"
	profile.IsDefault = true

	updatedProfile, err := models.SaveLLMProfile(ctx, profile)
	if err != nil {
		t.Fatalf("Failed to update profile: %v", err)
	}

	if updatedProfile.Name != "Updated Test Profile" {
		t.Errorf("Updated profile name mismatch, got %s, want %s", updatedProfile.Name, "Updated Test Profile")
	}

	// Test Get by User
	userProfiles, err := models.GetLLMProfilesByUser(ctx, "test-user-crud")
	if err != nil {
		t.Fatalf("Failed to get user profiles: %v", err)
	}

	if len(userProfiles) != 1 {
		t.Errorf("Expected 1 profile for user, got %d", len(userProfiles))
	}

	// Test Get Default Profile
	defaultProfile, err := models.GetDefaultLLMProfile(ctx, "test-user-crud")
	if err != nil {
		t.Fatalf("Failed to get default profile: %v", err)
	}

	if defaultProfile == nil {
		t.Error("Expected to find default profile, got nil")
	} else if !defaultProfile.IsDefault {
		t.Error("Retrieved profile should be marked as default")
	}

	// Test Set Default
	err = models.SetDefaultLLMProfile(ctx, profile.ID, "test-user-crud")
	if err != nil {
		t.Fatalf("Failed to set default profile: %v", err)
	}

	// Test Delete
	err = models.DeleteLLMProfile(ctx, profile.ID)
	if err != nil {
		t.Fatalf("Failed to delete profile: %v", err)
	}

	// Verify deletion
	_, err = models.GetLLMProfile(ctx, profile.ID)
	if err == nil {
		t.Error("Expected error when getting deleted profile, got nil")
	}
}

func TestLLMProfile_Validation(t *testing.T) {
	client := SetupTestMongoClient(context.Background(), t)
	if client == nil {
		return
	}
	defer client.Disconnect(context.Background())

	err := models.InitializeLLMProfiles(client, "test_zurabase")
	if err != nil {
		t.Fatalf("Failed to initialize LLM profiles: %v", err)
	}

	ctx := context.Background()

	// Test empty API key handling - should fail encryption
	profile := &models.LLMProfile{
		ID:        "test-empty-key",
		UserID:    "test-user",
		Name:      "Test Empty Key",
		ServerURL: "https://api.test.com",
		APIKey:    "", // Empty API key
		Model:     "gpt-4",
		IsDefault: false,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	_, err = models.SaveLLMProfile(ctx, profile)
	if err == nil {
		t.Fatalf("Expected error when saving profile with empty API key, but got none")
	}

	expectedError := "failed to encrypt API key: API key cannot be empty before encryption"
	if err.Error() != expectedError {
		t.Errorf("Expected error '%s', got '%v'", expectedError, err)
	}

	// Test with a valid API key
	profile.APIKey = "valid-api-key"
	_, err = models.SaveLLMProfile(ctx, profile)
	if err != nil {
		t.Fatalf("Failed to save profile with valid API key: %v", err)
	}

	// Verify the profile can be retrieved and decrypted
	retrievedProfile, err := models.GetLLMProfile(ctx, profile.ID)
	if err != nil {
		t.Fatalf("Failed to get profile: %v", err)
	}

	if retrievedProfile.APIKey != "valid-api-key" {
		t.Errorf("Expected API key 'valid-api-key', got %s", retrievedProfile.APIKey)
	}

	// Clean up
	_ = models.DeleteLLMProfile(ctx, profile.ID)
}

func TestLLMProfile_ToResponse(t *testing.T) {
	profile := &models.LLMProfile{
		ID:        "test-response-id",
		UserID:    "test-user",
		Name:      "Test Response Profile",
		ServerURL: "https://api.test.com",
		APIKey:    "secret-api-key",
		IsDefault: true,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	response := profile.ToResponse()

	// Verify response doesn't include API key
	if response.ID != profile.ID {
		t.Errorf("Response ID mismatch, got %s, want %s", response.ID, profile.ID)
	}
	if response.Name != profile.Name {
		t.Errorf("Response name mismatch, got %s, want %s", response.Name, profile.Name)
	}
	if response.ServerURL != profile.ServerURL {
		t.Errorf("Response server URL mismatch, got %s, want %s", response.ServerURL, profile.ServerURL)
	}
	if response.IsDefault != profile.IsDefault {
		t.Errorf("Response is_default mismatch, got %t, want %t", response.IsDefault, profile.IsDefault)
	}

	// The response should not expose the API key in any way
	// This is verified by the absence of APIKey field in LLMProfileResponse struct
}
