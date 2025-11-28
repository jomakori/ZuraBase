package tests

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"zurabase/internal/server"
)

type Note struct {
	ID       string `json:"id"`
	Text     string `json:"text"`
	CoverURL string `json:"cover_url"`
}

func saveNote(ctx context.Context, t *testing.T, note *Note) *Note {
	return DoPostRequest[Note, Note](ctx, t, "/note", *note)
}

func getNote(ctx context.Context, t *testing.T, id string) *Note {
	return DoGetRequest[Note](ctx, t, "/note/"+id)
}

func deleteNoteByID(ctx context.Context, t *testing.T, id string) {
	router := server.SetupTestRouter()

	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, "/note/"+id, nil)
	if err != nil {
		t.Fatalf("failed to create DELETE request: %v", err)
	}
	req.Header.Set("Origin", "http://localhost:5173")

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	// Don't check status code as DELETE might return 404 for non-existent notes
}

func TestNote_SaveSuccess(t *testing.T) {
	ctx := context.Background()
	note := &Note{
		ID:       "test-id-1",
		Text:     "Test note text",
		CoverURL: "https://example.com/cover.jpg",
	}

	deleteNoteByID(ctx, t, note.ID)

	saved := saveNote(ctx, t, note)
	if saved.Text != note.Text {
		t.Errorf("expected %q got %q", note.Text, saved.Text)
	}
	if saved.CoverURL != note.CoverURL {
		t.Errorf("expected %q got %q", note.CoverURL, saved.CoverURL)
	}
}

func TestNote_GetSuccess(t *testing.T) {
	ctx := context.Background()
	testNote := &Note{
		ID:       "test-id-2",
		Text:     "Test note text",
		CoverURL: "https://example.com/cover.jpg",
	}

	deleteNoteByID(ctx, t, testNote.ID)
	saveNote(ctx, t, testNote)

	got := getNote(ctx, t, testNote.ID)
	if got.Text != testNote.Text {
		t.Errorf("expected %q got %q", testNote.Text, got.Text)
	}
	if got.CoverURL != testNote.CoverURL {
		t.Errorf("expected %q got %q", testNote.CoverURL, got.CoverURL)
	}
}

func TestNote_GetNotFound(t *testing.T) {
	ctx := context.Background()
	deleteNoteByID(ctx, t, "non-existent-id")

	// For a non-existent note, the API should return 404
	router := server.SetupTestRouter()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, "/note/non-existent-id", nil)
	if err != nil {
		t.Fatalf("failed to create GET request: %v", err)
	}
	req.Header.Set("Origin", "http://localhost:5173")

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	// Expect 404 for non-existent note
	if rec.Code != http.StatusNotFound {
		t.Fatalf("expected status 404 for non-existent note, got %d", rec.Code)
	}
}
