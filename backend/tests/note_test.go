package main

import (
	"context"
	"testing"
	"fmt"
	"net/http"
	"bytes"
	"encoding/json"
	"log"
)


// Workaround: Duplicate type and stubs due to Go package limitations and file structure constraints.
type Note struct {
	ID       string `json:"id"`
	Text     string `json:"text"`
	CoverURL string `json:"cover_url"`
}

// Stub implementations to allow compilation. Replace with HTTP client calls for integration testing.
func SaveNote(ctx context.Context, note *Note) (*Note, error) {
	url := apiEndpoint + "/note"
	body, err := json.Marshal(note)
	if err != nil {
		return nil, fmt.Errorf("SaveNote: failed to marshal note: %w", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("SaveNote: failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("SaveNote: request failed: %w", err)
	}
	defer func() {
		if cerr := resp.Body.Close(); cerr != nil {
			log.Printf("SaveNote: failed to close response body: %v", cerr)
		}
	}()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("SaveNote: unexpected status: %s", resp.Status)
	}
	var savedNote Note
	if err := json.NewDecoder(resp.Body).Decode(&savedNote); err != nil {
		return nil, fmt.Errorf("SaveNote: failed to decode response: %w", err)
	}
	return &savedNote, nil
}

func GetNote(ctx context.Context, id string) (*Note, error) {
	url := fmt.Sprintf("%s/note/%s", apiEndpoint, id)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("GetNote: failed to create request: %w", err)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("GetNote: request failed: %w", err)
	}
	defer func() {
		if cerr := resp.Body.Close(); cerr != nil {
			log.Printf("GetNote: failed to close response body: %v", cerr)
		}
	}()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("GetNote: unexpected status: %s", resp.Status)
	}
	var note Note
	if err := json.NewDecoder(resp.Body).Decode(&note); err != nil {
		return nil, fmt.Errorf("GetNote: failed to decode response: %w", err)
	}
	return &note, nil
}

// TODO: Implement SaveNote and GetNote as HTTP client calls to the running backend server for integration testing,
func deleteNoteByID(ctx context.Context, id string) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodDelete, apiEndpoint+"/note/"+id, nil)
	if err != nil {
		return err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer func() {
		if cerr := resp.Body.Close(); cerr != nil {
			log.Printf("deleteNoteByID: failed to close response body: %v", cerr)
		}
	}()
	if resp.StatusCode != http.StatusNoContent && resp.StatusCode != http.StatusNotFound {
		return fmt.Errorf("unexpected status: %s", resp.Status)
	}
	return nil
}
// or duplicate their logic here if you want to test without running the server.
func TestSaveNote_Success(t *testing.T) {
    ctx := context.Background()
    note := &Note{
        ID:       "test-id-1",
        Text:     "Test note text",
        CoverURL: "https://example.com/cover.jpg",
    }

    // Clean up any existing note
    _ = deleteNoteByID(ctx, note.ID)

    savedNote, err := SaveNote(ctx, note)
    if err != nil {
        t.Fatalf("FAIL: expected no error, got %v", err)
    }

    if savedNote != nil {
        if savedNote.Text != note.Text {
        t.Errorf("expected text %q, got %q", note.Text, savedNote.Text)
        }
        if savedNote.CoverURL != note.CoverURL {
            t.Errorf("expected cover URL %q, got %q", note.CoverURL, savedNote.CoverURL)
        }
    }
}

func TestGetNote_Success(t *testing.T) {
    ctx := context.Background()

    // First create a test note
    testNote := &Note{
        ID:       "test-id-2",
        Text:     "Test note text",
        CoverURL: "https://example.com/cover.jpg",
    }

    // Clean up any existing note
    _ = deleteNoteByID(ctx, testNote.ID)

    _, err := SaveNote(ctx, testNote)
    if err != nil {
        t.Fatalf("FAIL: failed to create test note: %v", err)
    }

    // Now test getting the note
    note, err := GetNote(ctx, testNote.ID)
    if err != nil {
        t.Fatalf("FAIL: expected no error, got %v", err)
    }

    if note != nil {
        // Verify the retrieved note matches
        if note.Text != testNote.Text {
        t.Errorf("expected text %q, got %q", testNote.Text, note.Text)
        }
        if note.CoverURL != testNote.CoverURL {
            t.Errorf("expected cover URL %q, got %q", testNote.CoverURL, note.CoverURL)
        }
    }
}

func TestGetNote_NotFound(t *testing.T) {
    ctx := context.Background()

    // Clean up any existing note
    _ = deleteNoteByID(ctx, "non-existent-id")

    // Try to get a non-existent note
    _, err := GetNote(ctx, "non-existent-id")
    if err == nil {
        t.Fatal("expected an error, got nil")
    }
}
