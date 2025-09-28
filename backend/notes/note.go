package notes

import (
	"context"
	"log"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// Note represents a markdown note
type Note struct {
	ID       string    `json:"id" bson:"id"`
	Text     string    `json:"text,omitempty" bson:"text"`
	Content  string    `json:"content,omitempty" bson:"content"`
	CoverURL string    `json:"cover_url" bson:"cover_url"`
	CreatedAt time.Time `json:"created_at" bson:"created_at"`
	UpdatedAt time.Time `json:"updated_at" bson:"updated_at"`
}

var noteCollection *mongo.Collection

// Initialize sets up the MongoDB collection for the notes package
func Initialize(client *mongo.Client, dbName string) {
	noteCollection = client.Database(dbName).Collection("notes")
}

// SaveNote saves or updates a note in the database
func SaveNote(ctx context.Context, note *Note) (*Note, error) {
	log.Printf("SaveNote: saving note with ID=%s", note.ID)
	if note.Text == "" && note.Content != "" {
		note.Text = note.Content
	}
	now := time.Now()
	if note.CreatedAt.IsZero() {
		note.CreatedAt = now
	}
	note.UpdatedAt = now

// Save or update
	filter := bson.M{"id": note.ID}
	update := bson.M{"$set": note}
	opts := options.Update().SetUpsert(true)

	_, err := noteCollection.UpdateOne(ctx, filter, update, opts)
	if err != nil {
		log.Printf("SaveNote: error saving note: %v", err)
		return nil, err
	}
	return note, nil
}

// GetNote retrieves a note by ID
func GetNote(ctx context.Context, id string) (*Note, error) {
	var note Note
	err := noteCollection.FindOne(ctx, bson.M{"id": id}).Decode(&note)
	if err != nil {
		log.Printf("GetNote: error retrieving note ID=%s: %v", id, err)
		return nil, err
	}
	log.Printf("GetNote: retrieved note with ID=%s", note.ID)
	return &note, nil
}

// DeleteNote deletes a note by ID
func DeleteNote(ctx context.Context, id string) error {
	log.Printf("DeleteNote: deleting note ID=%s", id)
	_, err := noteCollection.DeleteOne(ctx, bson.M{"id": id})
	return err
}

// existing functions above are correct; removed duplicate HandleNoteRequest to avoid redeclaration
