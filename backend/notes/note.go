package notes

import (
	"context"
	"database/sql"
	"log"
)

// Note represents a markdown note
type Note struct {
	ID       string `json:"id"`
	Text     string `json:"text"`
	CoverURL string `json:"cover_url"`
}

var db *sql.DB

// Initialize sets up the database connection for the notes package
func Initialize(database *sql.DB) {
	db = database
}

// SaveNote saves or updates a note in the database
func SaveNote(ctx context.Context, note *Note) (*Note, error) {
	log.Printf("SaveNote: saving note: ID=%s, Text=%s, CoverURL=%s", note.ID, note.Text, note.CoverURL)
	// Save or update the note in the database.
	_, err := db.ExecContext(ctx, `
		INSERT INTO note (id, text, cover_url) VALUES ($1, $2, $3)
		ON CONFLICT (id) DO UPDATE SET text=$2, cover_url=$3
	`, note.ID, note.Text, note.CoverURL)
	if err != nil {
		log.Printf("SaveNote: error saving note: %v", err)
		return nil, err
	}
	return note, nil
}

// GetNote retrieves a note by ID
func GetNote(ctx context.Context, id string) (*Note, error) {
	note := &Note{ID: id}
	err := db.QueryRowContext(ctx, `
		SELECT text, cover_url FROM note
		WHERE id = $1
	`, id).Scan(&note.Text, &note.CoverURL)
	if err != nil {
		log.Printf("GetNote: error retrieving note ID=%s: %v", id, err)
		return nil, err
	}
	log.Printf("GetNote: retrieved note: ID=%s, Text=%s, CoverURL=%s", note.ID, note.Text, note.CoverURL)
	return note, nil
}

// DeleteNote deletes a note by ID
func DeleteNote(ctx context.Context, id string) error {
	log.Printf("DeleteNote: deleting note ID=%s", id)
	_, err := db.ExecContext(ctx, `DELETE FROM note WHERE id = $1`, id)
	return err
}
