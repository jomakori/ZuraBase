package notes

import (
	"context"
	"log"
	"time"

	"strings"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// extractTitleFromContent derives a title from markdown content.
// It checks for the first '# ' header; if none, returns the first nonempty line.
// If no text exists at all, it defaults to "Untitled Note".
func extractTitleFromContent(content string) string {
	lines := strings.Split(content, "\n")
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}
		if strings.HasPrefix(trimmed, "# ") {
			return strings.TrimSpace(trimmed[2:])
		}
		return trimmed
	}
	return "Untitled Note"
}

// Note represents a markdown note
type Note struct {
	ID        string    `json:"id" bson:"id"`
	UserID    string    `json:"user_id" bson:"user_id"` // added field for ownership
	Title     string    `json:"title,omitempty" bson:"title"`
	Text      string    `json:"text,omitempty" bson:"text"`
	Content   string    `json:"content,omitempty" bson:"content"`
	CoverURL  string    `json:"cover_url" bson:"cover_url"`
	CreatedAt time.Time `json:"created_at" bson:"created_at"`
	UpdatedAt time.Time `json:"updated_at" bson:"updated_at"`
}

var noteCollection *mongo.Collection

// Initialize sets up the MongoDB collection for the notes package
func Initialize(client *mongo.Client, dbName string) {
	noteCollection = client.Database(dbName).Collection("notes")
}

// SaveNote saves or updates a note in the database
func SaveNote(ctx context.Context, note *Note, userID string) (*Note, error) {
	log.Printf("SaveNote: saving note with ID=%s for user=%s", note.ID, userID)
	
	if userID != "" {
		note.UserID = userID
	}
	if note.Text == "" && note.Content != "" {
		note.Text = note.Content
	}

	// Always extract/update title from content to keep synced with current markdown
	if note.Content != "" {
		note.Title = extractTitleFromContent(note.Content)
	} else if note.Title == "" {
		note.Title = "Untitled Note"
	}

	now := time.Now()
	if note.CreatedAt.IsZero() {
		note.CreatedAt = now
	}
	note.UpdatedAt = now

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

// GetNotesByUser retrieves all notes belonging to a specific user
func GetNotesByUser(ctx context.Context, userID string) ([]Note, error) {
	cursor, err := noteCollection.Find(ctx, bson.M{"user_id": userID})
	if err != nil {
		return nil, err
	}
	defer cursor.Close(ctx)

	var notes []Note
	for cursor.Next(ctx) {
		var note Note
		if err := cursor.Decode(&note); err != nil {
			return nil, err
		}
		notes = append(notes, note)
	}
	if err := cursor.Err(); err != nil {
		return nil, err
	}
	return notes, nil
}

