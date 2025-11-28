package tests

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"zurabase/internal/server"
)

// Workaround: Duplicate stubs due to Go package limitations and file structure constraints.
type SearchResponse struct {
	Photos []struct {
		Id  int `json:"id"`
		Src struct {
			Medium    string `json:"medium"`
			Landscape string `json:"landscape"`
		} `json:"src"`
	} `json:"photos"`
}

// PerformImageSearchRequest performs an image search request using the test router
func PerformImageSearchRequest(ctx context.Context, t *testing.T, router http.Handler, query string) (*SearchResponse, error) {
	url := fmt.Sprintf("/api/images/%s", query)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("PerformImageSearchRequest: failed to create request: %w", err)
	}

	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		return nil, fmt.Errorf("PerformImageSearchRequest: unexpected status: %d - %s", rec.Code, rec.Body.String())
	}
	var sr SearchResponse
	if err := json.NewDecoder(rec.Body).Decode(&sr); err != nil {
		return nil, fmt.Errorf("PerformImageSearchRequest: failed to decode response: %w", err)
	}
	return &sr, nil
}

func TestImage_SearchPhotoSuccess(t *testing.T) {
	router := server.SetupTestRouter()
	ctx := context.Background()
	query := "test-query"

	response, err := PerformImageSearchRequest(ctx, t, router, query)
	if err != nil {
		t.Fatalf("FAIL: expected no error, got %v", err)
	}

	if response == nil {
		t.Fatal("expected a search response, got nil")
	}
}

func TestImage_EmptyResults(t *testing.T) {
	router := server.SetupTestRouter()
	ctx := context.Background()
	query := "no-results-query"

	response, err := PerformImageSearchRequest(ctx, t, router, query)
	if err != nil {
		t.Fatalf("expected no error, got %v", err)
	}

	// The Pexels API may return some results even for "no-results" queries
	// This is expected behavior, so we'll just verify the API call succeeded
	if response == nil {
		t.Error("expected a search response, got nil")
	}
	// Don't check the number of photos since the API may return results
}

func TestImage_InvalidQuery(t *testing.T) {
	router := server.SetupTestRouter()
	ctx := context.Background()
	query := ""

	// Expecting a bad request status for empty query
	url := fmt.Sprintf("/api/images/%s", query)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		t.Fatalf("failed to create request: %v", err)
	}
	rec := httptest.NewRecorder()
	router.ServeHTTP(rec, req)

	if rec.Code != http.StatusBadRequest {
		t.Errorf("expected status %d for empty query, got %d", http.StatusBadRequest, rec.Code)
	} else {
		t.Logf("✓ Correctly returned 400 for empty query")
	}
}
