package models

import (
	"context"
	"log"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Strand represents a piece of captured information that has been enriched with AI
type Strand struct {
	ID         string    `json:"id" bson:"id"`
	UserID     string    `json:"user_id" bson:"user_id"`
	Content    string    `json:"content" bson:"content"`
	Source     string    `json:"source" bson:"source"` // "whatsapp", "manual", etc.
	Tags       []string  `json:"tags" bson:"tags"`
	Summary    string    `json:"summary" bson:"summary"`
	RelatedIDs []string  `json:"related_ids" bson:"related_ids"`
	CreatedAt  time.Time `json:"created_at" bson:"created_at"`
	UpdatedAt  time.Time `json:"updated_at" bson:"updated_at"`
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
	log.Printf("SaveStrand: saving strand with ID=%s for user=%s", strand.ID, strand.UserID)

	now := time.Now()
	if strand.CreatedAt.IsZero() {
		strand.CreatedAt = now
	}
	strand.UpdatedAt = now

	filter := bson.M{"id": strand.ID}
	update := bson.M{"$set": strand}
	opts := options.Update().SetUpsert(true)

	_, err := strandCollection.UpdateOne(ctx, filter, update, opts)
	if err != nil {
		log.Printf("SaveStrand: error saving strand: %v", err)
		return nil, err
	}
	return strand, nil
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
