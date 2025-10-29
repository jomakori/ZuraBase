package tests

import (
	"context"
	"fmt"
	"net/http"
	"testing"
	"time"
)

// Strand represents a strand in the API
type Strand struct {
	ID         string    `json:"id"`
	UserID     string    `json:"user_id"`
	Content    string    `json:"content"`
	Source     string    `json:"source"`
	Tags       []string  `json:"tags"`
	Summary    string    `json:"summary"`
	RelatedIDs []string  `json:"related_ids"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

// StrandResponse represents the response from the strands API
type StrandResponse struct {
	Strand  *Strand  `json:"strand,omitempty"`
	Strands []Strand `json:"strands,omitempty"`
	Tags    []string `json:"tags,omitempty"`
	Error   string   `json:"error,omitempty"`
	Count   int      `json:"count,omitempty"`
	Page    int      `json:"page,omitempty"`
	Limit   int      `json:"limit,omitempty"`
}

// Helper functions for strand API operations
func saveStrand(ctx context.Context, t *testing.T, strand *Strand) *Strand {
	resp := doPostRequest[StrandResponse, Strand](ctx, t, "/strands/ingest", *strand)
	return resp.Strand
}

func getStrand(ctx context.Context, t *testing.T, id string) *Strand {
	resp := doGetRequest[StrandResponse](ctx, t, "/strands/"+id)
	return resp.Strand
}

func deleteStrandByID(ctx context.Context, t *testing.T, id string) {
	url := fmt.Sprintf("%s/strands/%s", getAPIEndpoint(), id)
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

// TestSaveStrand_Success tests saving a strand
func TestSaveStrand_Success(t *testing.T) {
	ctx := context.Background()

	// Create a test strand
	testStrand := &Strand{
		ID:        "test-strand-id",
		UserID:    "test-user-id",
		Content:   "This is a test strand content",
		Source:    "test",
		Tags:      []string{"test", "golang"},
		Summary:   "Test strand summary",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// Delete if it exists
	deleteStrandByID(ctx, t, testStrand.ID)

	// Save the strand
	saved := saveStrand(ctx, t, testStrand)
	if saved.Content != testStrand.Content {
		t.Errorf("expected content %q got %q", testStrand.Content, saved.Content)
	}
	if len(saved.Tags) != len(testStrand.Tags) {
		t.Errorf("expected %d tags, got %d", len(testStrand.Tags), len(saved.Tags))
	}
}

// TestGetStrand_Success tests retrieving a strand
func TestGetStrand_Success(t *testing.T) {
	ctx := context.Background()

	// Create a test strand
	testStrand := &Strand{
		ID:        "test-strand-id-2",
		UserID:    "test-user-id",
		Content:   "This is a test strand content for retrieval",
		Source:    "test",
		Tags:      []string{"test", "retrieval"},
		Summary:   "Test strand summary for retrieval",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// Delete if it exists, then save
	deleteStrandByID(ctx, t, testStrand.ID)
	saveStrand(ctx, t, testStrand)

	// Retrieve the strand
	got := getStrand(ctx, t, testStrand.ID)
	if got.Content != testStrand.Content {
		t.Errorf("expected content %q got %q", testStrand.Content, got.Content)
	}
	if len(got.Tags) != len(testStrand.Tags) {
		t.Errorf("expected %d tags, got %d", len(testStrand.Tags), len(got.Tags))
	}
}

// TestGetStrands tests retrieving strands with tag filtering
func TestGetStrands(t *testing.T) {
	ctx := context.Background()
	userID := "test-user-id"

	// Create test strands with different tags
	strands := []*Strand{
		{
			ID:        "test-strand-list-1",
			UserID:    userID,
			Content:   "Strand 1 content",
			Source:    "test",
			Tags:      []string{"tag1", "tag2"},
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		},
		{
			ID:        "test-strand-list-2",
			UserID:    userID,
			Content:   "Strand 2 content",
			Source:    "test",
			Tags:      []string{"tag2", "tag3"},
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		},
	}

	// Delete if they exist, then save
	for _, strand := range strands {
		deleteStrandByID(ctx, t, strand.ID)
		saveStrand(ctx, t, strand)
	}

	// Get all strands
	resp := doGetRequest[StrandResponse](ctx, t, "/strands")
	if resp.Count < 2 {
		t.Errorf("expected at least 2 strands, got %d", resp.Count)
	}

	// Get strands filtered by tag
	resp = doGetRequest[StrandResponse](ctx, t, "/strands?tags=tag2")
	if resp.Count < 2 {
		t.Errorf("expected at least 2 strands with tag2, got %d", resp.Count)
	}

	// Clean up
	for _, strand := range strands {
		deleteStrandByID(ctx, t, strand.ID)
	}
}
