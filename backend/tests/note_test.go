package tests

import (
	"context"
	"fmt"
	"net/http"
	"testing"
)

type Note struct {
	ID       string `json:"id"`
	Text     string `json:"text"`
	CoverURL string `json:"cover_url"`
}

func saveNote(ctx context.Context, t *testing.T, note *Note) *Note {
	return doPostRequest[Note, Note](ctx, t, "/note", *note)
}

func getNote(ctx context.Context, t *testing.T, id string) *Note {
	return doGetRequest[Note](ctx, t, "/note/"+id)
}

func deleteNoteByID(ctx context.Context, t *testing.T, id string) {
	url := fmt.Sprintf("%s/note/%s", getAPIEndpoint(), id)
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, url, nil)
	if err != nil {
		t.Fatalf("failed to create DELETE request: %v", err)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("failed DELETE request: %v", err)
	}
	defer resp.Body.Close()
}

func TestSaveNote_Success(t *testing.T) {
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

func TestGetNote_Success(t *testing.T) {
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

func TestGetNote_NotFound(t *testing.T) {
	ctx := context.Background()
	deleteNoteByID(ctx, t, "non-existent-id")

	got := getNote(ctx, t, "non-existent-id")
	if got != nil {
		t.Errorf("expected nil for missing note, got %+v", got)
	}
}
