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
		log.Printf("Warning: LLM_ENCRYPTION_KEY not set, generating a random key")
		// Generate a random key if not provided
		encryptionKey = make([]byte, 32) // AES-256 requires 32 bytes
		if _, err := rand.Read(encryptionKey); err != nil {
			return fmt.Errorf("failed to generate encryption key: %w", err)
		}
	} else {
		// Use the provided key (must be 32 bytes for AES-256)
		decoded, err := base64.StdEncoding.DecodeString(keyStr)
		if err != nil || len(decoded) != 32 {
			return fmt.Errorf("invalid LLM_ENCRYPTION_KEY: must be a base64-encoded 32-byte key")
		}
		encryptionKey = decoded
	}

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
		return nil // Nothing to encrypt
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

	// Create a nonce
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return err
	}

	// Encrypt the API key
	ciphertext := gcm.Seal(nonce, nonce, []byte(p.APIKey), nil)

	// Store the encrypted API key as base64
	p.APIKey = base64.StdEncoding.EncodeToString(ciphertext)

	return nil
}

// Decrypt decrypts the API key after retrieving from database
func (p *LLMProfile) Decrypt() error {
	if p.APIKey == "" {
		return nil // Nothing to decrypt
	}

	// Decode the base64 encrypted API key
	ciphertext, err := base64.StdEncoding.DecodeString(p.APIKey)
	if err != nil {
		return err
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

	return nil
}

// SaveLLMProfile saves or updates an LLM profile in the database
func SaveLLMProfile(ctx context.Context, profile *LLMProfile) (*LLMProfile, error) {
	// Create a timeout context
	timeoutCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

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

	// Decrypt the API key
	if err := profile.Decrypt(); err != nil {
		log.Printf("Warning: Failed to decrypt API key for profile %s: %v", profile.ID, err)
		// Set API key to empty string to indicate it needs to be re-entered
		profile.APIKey = ""
	}

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
