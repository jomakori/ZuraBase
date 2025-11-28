package models

import (
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// LLMProfile represents a user's LLM configuration profile
type LLMProfile struct {
	ID        string    `json:"id" bson:"id"`
	UserID    string    `json:"user_id" bson:"user_id"`
	Name      string    `json:"name" bson:"name"`
	ServerURL string    `json:"server_url" bson:"server_url"`
	APIKey    string    `json:"api_key" bson:"api_key_encrypted"`
	Model     string    `json:"model" bson:"model"`
	IsDefault bool      `json:"is_default" bson:"is_default"`
	CreatedAt time.Time `json:"created_at" bson:"created_at"`
	UpdatedAt time.Time `json:"updated_at" bson:"updated_at"`
}

// LLMProfileResponse is the response structure for API calls
// It omits the API key for security
type LLMProfileResponse struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Name      string    `json:"name"`
	ServerURL string    `json:"server_url"`
	Model     string    `json:"model"`
	IsDefault bool      `json:"is_default"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

var llmProfileCollection *mongo.Collection
var encryptionKey []byte

// InitializeLLMProfiles sets up the MongoDB collection for LLM profiles
func InitializeLLMProfiles(client *mongo.Client, dbName string) error {
	llmProfileCollection = client.Database(dbName).Collection("llm_profiles")

	// Create indexes for efficient querying
	indexModels := []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "user_id", Value: 1}},
			Options: options.Index().SetBackground(true),
		},
		{
			Keys:    bson.D{{Key: "is_default", Value: 1}},
			Options: options.Index().SetBackground(true),
		},
	}

	_, err := llmProfileCollection.Indexes().CreateMany(context.Background(), indexModels)
	if err != nil {
		log.Printf("Error creating LLM profile indexes: %v", err)
		return err
	}

	// Initialize encryption key from environment variable
	keyStr := os.Getenv("LLM_ENCRYPTION_KEY")
	if keyStr == "" {
		return fmt.Errorf("LLM_ENCRYPTION_KEY environment variable is not set. Please set it to a base64-encoded 32-byte key.")
	}

	// Use the provided key (must be 32 bytes for AES-256)
	decoded, err := base64.StdEncoding.DecodeString(keyStr)
	if err != nil || len(decoded) != 32 {
		return fmt.Errorf("invalid LLM_ENCRYPTION_KEY: must be a base64-encoded 32-byte key. Error: %w", err)
	}
	encryptionKey = decoded

	return nil
}

// ToResponse converts an LLMProfile to LLMProfileResponse (omitting sensitive data)
func (p *LLMProfile) ToResponse() *LLMProfileResponse {
	return &LLMProfileResponse{
		ID:        p.ID,
		UserID:    p.UserID,
		Name:      p.Name,
		ServerURL: p.ServerURL,
		Model:     p.Model,
		IsDefault: p.IsDefault,
		CreatedAt: p.CreatedAt,
		UpdatedAt: p.UpdatedAt,
	}
}

// Encrypt encrypts the API key before saving
func (p *LLMProfile) Encrypt() error {
	if p.APIKey == "" {
		return fmt.Errorf("API key cannot be empty before encryption")
	}

	if encryptionKey == nil || len(encryptionKey) != 32 {
		return fmt.Errorf("invalid or missing encryption key environment variable")
	}

	block, err := aes.NewCipher(encryptionKey)
	if err != nil {
		return fmt.Errorf("failed to create AES block: %w", err)
	}

	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return fmt.Errorf("failed to create AES-GCM: %w", err)
	}

	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return fmt.Errorf("failed to generate nonce: %w", err)
	}

	ciphertext := gcm.Seal(nonce, nonce, []byte(p.APIKey), nil)
	p.APIKey = base64.StdEncoding.EncodeToString(ciphertext)

	log.Printf("🔐 Encrypted API key for profile %s at %s | nonceSize=%d | cipherLen=%d", p.ID, p.UpdatedAt.Format(time.RFC3339), len(nonce), len(ciphertext))
	return nil
}

// Decrypt decrypts the API key after retrieving from database
func (p *LLMProfile) Decrypt() error {
	if p.APIKey == "" {
		return nil // Nothing to decrypt
	}

	// Attempt to decode the base64 encrypted API key
	ciphertext, err := base64.StdEncoding.DecodeString(p.APIKey)
	if err != nil {
		log.Printf("❌ Decryption error for profile %s: invalid base64 data; ensure key was encrypted properly", p.ID)
		return fmt.Errorf("decryption failed for profile %s: invalid base64 data", p.ID)
	}

	// Create a new AES cipher block
	block, err := aes.NewCipher(encryptionKey)
	if err != nil {
		return err
	}

	// Create a new GCM cipher
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return err
	}

	// Check if the ciphertext is valid
	if len(ciphertext) < gcm.NonceSize() {
		return errors.New("ciphertext too short")
	}

	// Extract the nonce and ciphertext
	nonce, ciphertext := ciphertext[:gcm.NonceSize()], ciphertext[gcm.NonceSize():]

	// Decrypt the API key
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return err
	}

	// Store the decrypted API key
	p.APIKey = string(plaintext)
	log.Printf("🔓 Decrypted API key for profile %s successfully | len=%d", p.ID, len(plaintext))
	return nil
}

// SaveLLMProfile saves or updates an LLM profile in the database
func SaveLLMProfile(ctx context.Context, profile *LLMProfile) (*LLMProfile, error) {
	// Create a timeout context
	timeoutCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	// Validate required fields
	if profile.Model == "" {
		return nil, fmt.Errorf("model field is required")
	}
	if profile.Name == "" {
		return nil, fmt.Errorf("name field is required")
	}
	if profile.ServerURL == "" {
		return nil, fmt.Errorf("server URL field is required")
	}

	// Set timestamps
	now := time.Now()
	if profile.CreatedAt.IsZero() {
		profile.CreatedAt = now
	}
	profile.UpdatedAt = now

	// Create a copy to avoid modifying the original
	profileCopy := *profile

	// Encrypt the API key
	if err := profileCopy.Encrypt(); err != nil {
		return nil, fmt.Errorf("failed to encrypt API key: %w", err)
	}

	// If this profile is set as default, unset any other default profiles for this user
	if profile.IsDefault {
		if _, err := llmProfileCollection.UpdateMany(
			timeoutCtx,
			bson.M{
				"user_id":    profile.UserID,
				"id":         bson.M{"$ne": profile.ID},
				"is_default": true,
			},
			bson.M{"$set": bson.M{"is_default": false}},
		); err != nil {
			log.Printf("Warning: Failed to unset other default profiles: %v", err)
		}
	}

	// Save the profile
	filter := bson.M{"id": profile.ID}
	update := bson.M{"$set": profileCopy}
	opts := options.Update().SetUpsert(true)

	_, err := llmProfileCollection.UpdateOne(timeoutCtx, filter, update, opts)
	if err != nil {
		return nil, fmt.Errorf("failed to save LLM profile: %w", err)
	}

	// Return the original profile (with unencrypted API key)
	return profile, nil
}

// GetLLMProfile retrieves an LLM profile by ID
func GetLLMProfile(ctx context.Context, id string) (*LLMProfile, error) {
	var profile LLMProfile
	err := llmProfileCollection.FindOne(ctx, bson.M{"id": id}).Decode(&profile)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, fmt.Errorf("LLM profile not found: %s", id)
		}
		return nil, fmt.Errorf("failed to retrieve LLM profile: %w", err)
	}

	// Decrypt the API key
	if err := profile.Decrypt(); err != nil {
		log.Printf("Warning: Failed to decrypt API key for profile %s: %v", profile.ID, err)
		// Set API key to empty string to indicate it needs to be re-entered
		profile.APIKey = ""
	}

	return &profile, nil
}

// GetLLMProfilesByUser retrieves all LLM profiles for a user
func GetLLMProfilesByUser(ctx context.Context, userID string) ([]*LLMProfile, error) {
	cursor, err := llmProfileCollection.Find(ctx, bson.M{"user_id": userID})
	if err != nil {
		return nil, fmt.Errorf("failed to retrieve LLM profiles: %w", err)
	}
	defer cursor.Close(ctx)

	var profiles []*LLMProfile
	for cursor.Next(ctx) {
		var profile LLMProfile
		if err := cursor.Decode(&profile); err != nil {
			return nil, fmt.Errorf("failed to decode LLM profile: %w", err)
		}

		// Decrypt the API key
		if err := profile.Decrypt(); err != nil {
			log.Printf("Warning: Failed to decrypt API key for profile %s: %v", profile.ID, err)
			// Set API key to empty string to indicate it needs to be re-entered
			profile.APIKey = ""
		}

		profiles = append(profiles, &profile)
	}

	if err := cursor.Err(); err != nil {
		return nil, fmt.Errorf("cursor error: %w", err)
	}

	return profiles, nil
}

// GetDefaultLLMProfile retrieves the default LLM profile for a user
func GetDefaultLLMProfile(ctx context.Context, userID string) (*LLMProfile, error) {
	var profile LLMProfile
	err := llmProfileCollection.FindOne(ctx, bson.M{
		"user_id":    userID,
		"is_default": true,
	}).Decode(&profile)

	if err != nil {
		if err == mongo.ErrNoDocuments {
			return nil, nil // No default profile found
		}
		return nil, fmt.Errorf("failed to retrieve default LLM profile: %w", err)
	}

	log.Printf("🔍 Raw profile from DB: ID=%s, Name=%s, ServerURL='%s', Model=%s, APIKey(encrypted)=%v chars",
		profile.ID, profile.Name, profile.ServerURL, profile.Model, len(profile.APIKey))

	// Explicit validation and decryption pipeline
	if encryptionKey == nil || len(encryptionKey) != 32 {
		log.Printf("❌ Invalid encryption key — ensure LLM_ENCRYPTION_KEY is 32-byte base64 encoded")
		return nil, fmt.Errorf("invalid encryption key configuration")
	}

	// Attempt decryption
	if err := profile.Decrypt(); err != nil {
		log.Printf("❌ Failed to decrypt LLM profile API key for user=%s, profile=%s: %v", userID, profile.ID, err)
		return nil, fmt.Errorf("failed to decrypt API key for default profile: %w", err)
	}

	log.Printf("🔍 After decryption: ServerURL='%s', APIKey=%v chars", profile.ServerURL, len(profile.APIKey))

	// Validate required fields
	if profile.ServerURL == "" {
		log.Printf("❌ Missing ServerURL in LLM profile for user=%s", userID)
		return nil, fmt.Errorf("missing ServerURL in LLM profile - please update your profile in settings")
	}

	if profile.APIKey == "" {
		log.Printf("❌ Missing API key after decryption for user=%s", userID)
		return nil, fmt.Errorf("missing API key in LLM profile")
	}

	log.Printf("✅ Loaded and decrypted LLM profile for user=%s | Model=%s | URL=%s | KeyLen=%d",
		userID, profile.Model, profile.ServerURL, len(profile.APIKey))

	return &profile, nil
}

// DeleteLLMProfile deletes an LLM profile
func DeleteLLMProfile(ctx context.Context, id string) error {
	result, err := llmProfileCollection.DeleteOne(ctx, bson.M{"id": id})
	if err != nil {
		return fmt.Errorf("failed to delete LLM profile: %w", err)
	}

	if result.DeletedCount == 0 {
		return fmt.Errorf("LLM profile not found: %s", id)
	}

	return nil
}

// SetDefaultLLMProfile sets a profile as the default for a user
func SetDefaultLLMProfile(ctx context.Context, id string, userID string) error {
	// First, verify the profile exists and belongs to the user
	var profile LLMProfile
	err := llmProfileCollection.FindOne(ctx, bson.M{
		"id":      id,
		"user_id": userID,
	}).Decode(&profile)

	if err != nil {
		if err == mongo.ErrNoDocuments {
			return fmt.Errorf("LLM profile not found or does not belong to user")
		}
		return fmt.Errorf("failed to retrieve LLM profile: %w", err)
	}

	// Unset any existing default profiles for this user
	_, err = llmProfileCollection.UpdateMany(
		ctx,
		bson.M{
			"user_id":    userID,
			"is_default": true,
		},
		bson.M{"$set": bson.M{"is_default": false}},
	)
	if err != nil {
		return fmt.Errorf("failed to unset existing default profiles: %w", err)
	}

	// Set the specified profile as default
	_, err = llmProfileCollection.UpdateOne(
		ctx,
		bson.M{"id": id},
		bson.M{"$set": bson.M{"is_default": true}},
	)
	if err != nil {
		return fmt.Errorf("failed to set profile as default: %w", err)
	}

	return nil
}
