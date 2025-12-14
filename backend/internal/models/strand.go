package models

import (
	"context"
	"log"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// SyncLog represents a single sync operation's result
type SyncLog struct {
	Timestamp          time.Time `json:"timestamp" bson:"timestamp"`
	Summary            string    `json:"summary" bson:"summary"`
	Tags               []string  `json:"tags" bson:"tags"`
	SyncedByAI         bool      `json:"synced_by_ai" bson:"synced_by_ai"`
	Notes              string    `json:"notes,omitempty" bson:"notes,omitempty"`
	ModelOverride      bool      `json:"model_override,omitempty" bson:"model_override,omitempty"`
	ModelUsed          string    `json:"model_used,omitempty" bson:"model_used,omitempty"`
	OverrideReason     string    `json:"override_reason,omitempty" bson:"override_reason,omitempty"`
}

// FileAttachment represents an uploaded file attachment
type FileAttachment struct {
	ID          string    `json:"id" bson:"id"`
	Filename    string    `json:"filename" bson:"filename"`
	OriginalName string   `json:"original_name" bson:"original_name"`
	MimeType    string    `json:"mime_type" bson:"mime_type"`
	Size        int64     `json:"size" bson:"size"`
	URL         string    `json:"url" bson:"url"`
	UploadedAt  time.Time `json:"uploaded_at" bson:"uploaded_at"`
}

// Strand represents a piece of captured information that has been enriched with AI
type Strand struct {
	ID              string           `json:"id" bson:"id"`
	UserID          string           `json:"user_id" bson:"user_id"`
	Content         string           `json:"content" bson:"content"`
	Source          string           `json:"source" bson:"source"` // "whatsapp", "manual", etc.
	Tags            []string         `json:"tags" bson:"tags"`
	Summary         string           `json:"summary" bson:"summary"`
	RelatedIDs      []string         `json:"related_ids" bson:"related_ids"`
	SyncedWithAI    bool             `json:"synced_with_ai" bson:"synced_with_ai"`
	AIStatus        string           `json:"ai_status" bson:"ai_status"` // "idle", "processing", "completed", "failed"
	AIFailureReason string           `json:"ai_failure_reason,omitempty" bson:"ai_failure_reason,omitempty"`
	SyncHistory     []SyncLog        `json:"sync_history" bson:"sync_history"`
	Attachments     []FileAttachment `json:"attachments,omitempty" bson:"attachments,omitempty"`
	CreatedAt       time.Time        `json:"created_at" bson:"created_at"`
	UpdatedAt       time.Time        `json:"updated_at" bson:"updated_at"`
}

var strandCollection *mongo.Collection

// Initialize sets up the MongoDB collection for the strands package
func Initialize(client *mongo.Client, dbName string) {
	strandCollection = client.Database(dbName).Collection("strands")

	// Create indexes for efficient querying
	indexModels := []mongo.IndexModel{
		{
			Keys:    bson.D{{Key: "user_id", Value: 1}},
			Options: options.Index().SetBackground(true),
		},
		{
			Keys:    bson.D{{Key: "tags", Value: 1}},
			Options: options.Index().SetBackground(true),
		},
		{
			Keys:    bson.D{{Key: "created_at", Value: -1}},
			Options: options.Index().SetBackground(true),
		},
	}

	_, err := strandCollection.Indexes().CreateMany(context.Background(), indexModels)
	if err != nil {
		log.Printf("Error creating strand indexes: %v", err)
	}
}

// SaveStrand saves or updates a strand in the database
func SaveStrand(ctx context.Context, strand *Strand) (*Strand, error) {
	log.Printf("💾 Saving strand ID=%s (user=%s, synced=%v)", strand.ID, strand.UserID, strand.SyncedWithAI)

	// Ensure explicit boolean default
	if strand.SyncedWithAI != true && strand.SyncedWithAI != false {
		strand.SyncedWithAI = false
	}

	now := time.Now()
	if strand.CreatedAt.IsZero() {
		strand.CreatedAt = now
	}
	strand.UpdatedAt = now

	// Basic context protection
	timeoutCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()

	filter := bson.M{"id": strand.ID}
	update := bson.M{"$set": strand}
	opts := options.Update().SetUpsert(true)
	_, err := strandCollection.UpdateOne(timeoutCtx, filter, update, opts)
	if err != nil {
		log.Printf("❌ SaveStrand error for ID=%s: %v", strand.ID, err)
		return nil, err
	}

	log.Printf("✅ Strand %s saved successfully (SyncedWithAI=%v)", strand.ID, strand.SyncedWithAI)
	return strand, nil
}

// isConnectionError checks if an error is related to connection issues
func isConnectionError(err error) bool {
	if err == nil {
		return false
	}

	errMsg := err.Error()
	connectionErrors := []string{
		"connection refused",
		"connection reset",
		"broken pipe",
		"no reachable servers",
		"server selection timeout",
		"connection closed",
	}

	for _, msg := range connectionErrors {
		if strings.Contains(strings.ToLower(errMsg), msg) {
			return true
		}
	}

	return false
}

// GetStrand retrieves a strand by ID
func GetStrand(ctx context.Context, id string) (*Strand, error) {
	var strand Strand
	err := strandCollection.FindOne(ctx, bson.M{"id": id}).Decode(&strand)
	if err != nil {
		log.Printf("GetStrand: error retrieving strand ID=%s: %v", id, err)
		return nil, err
	}
	log.Printf("GetStrand: retrieved strand with ID=%s", strand.ID)
	return &strand, nil
}

// DeleteStrand deletes a strand by ID
func DeleteStrand(ctx context.Context, id string) error {
	log.Printf("DeleteStrand: deleting strand ID=%s", id)
	_, err := strandCollection.DeleteOne(ctx, bson.M{"id": id})
	return err
}

// GetStrandsByUser retrieves all strands belonging to a specific user
// with optional tag filtering
func GetStrandsByUser(ctx context.Context, userID string, tags []string, page, limit int64) ([]Strand, error) {
	filter := bson.M{"user_id": userID}

	// Add tag filtering if tags are provided
	if len(tags) > 0 {
		filter["tags"] = bson.M{"$all": tags}
	}

	// Set up pagination
	opts := options.Find().
		SetSort(bson.D{{Key: "created_at", Value: -1}}).
		SetSkip((page - 1) * limit).
		SetLimit(limit)

	cursor, err := strandCollection.Find(ctx, filter, opts)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var strands []Strand
	for cursor.Next(ctx) {
		var strand Strand
		if err := cursor.Decode(&strand); err != nil {
			return nil, err
		}
		strands = append(strands, strand)
	}
	if err := cursor.Err(); err != nil {
		return nil, err
	}
	return strands, nil
}

// GetAllTags retrieves all unique tags used across strands for a specific user
func GetAllTags(ctx context.Context, userID string) ([]string, error) {
	pipeline := mongo.Pipeline{
		{
			{"$match", bson.D{
				{"user_id", userID},
			}},
		},
		{
			{"$unwind", "$tags"},
		},
		{
			{"$group", bson.D{
				{"_id", nil},
				{"tags", bson.D{{"$addToSet", "$tags"}}},
			}},
		},
	}

	cursor, err := strandCollection.Aggregate(ctx, pipeline)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var result struct {
		Tags []string `bson:"tags"`
	}

	if cursor.Next(ctx) {
		if err := cursor.Decode(&result); err != nil {
			return nil, err
		}
		return result.Tags, nil
	}

	return []string{}, nil
}

// GetUnsyncedStrands retrieves all strands that haven't been synced with AI
func GetUnsyncedStrands(ctx context.Context) ([]Strand, error) {
	filter := bson.M{"synced_with_ai": false}

	cursor, err := strandCollection.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var strands []Strand
	for cursor.Next(ctx) {
		var strand Strand
		if err := cursor.Decode(&strand); err != nil {
			return nil, err
		}
		strands = append(strands, strand)
	}
	if err := cursor.Err(); err != nil {
		return nil, err
	}
	return strands, nil
}

// GetUnsyncedStrandsByUser retrieves all unsynced strands for a specific user
func GetUnsyncedStrandsByUser(ctx context.Context, userID string) ([]Strand, error) {
	filter := bson.M{
		"user_id":        userID,
		"synced_with_ai": false,
	}

	cursor, err := strandCollection.Find(ctx, filter)
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var strands []Strand
	for cursor.Next(ctx) {
		var strand Strand
		if err := cursor.Decode(&strand); err != nil {
			return nil, err
		}
		strands = append(strands, strand)
	}
	if err := cursor.Err(); err != nil {
		return nil, err
	}
	return strands, nil
}
