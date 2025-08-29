package main

import (
    "context"
    "testing"
    "fmt"
    "net/http"
    "encoding/json"
    "log"
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

func SearchPhoto(ctx context.Context, query string) (*SearchResponse, error) {
	url := fmt.Sprintf("%s/images/%s", apiEndpoint, query)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("SearchPhoto: failed to create request: %w", err)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("SearchPhoto: request failed: %w", err)
	}
	defer func() {
		if cerr := resp.Body.Close(); cerr != nil {
			log.Printf("SearchPhoto: failed to close response body: %v", cerr)
		}
	}()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("SearchPhoto: unexpected status: %s", resp.Status)
	}
	var sr SearchResponse
	if err := json.NewDecoder(resp.Body).Decode(&sr); err != nil {
		return nil, fmt.Errorf("SearchPhoto: failed to decode response: %w", err)
	}
	return &sr, nil
}

func TestSearchPhoto_Success(t *testing.T) {
    ctx := context.Background()
    query := "test-query"

    response, err := SearchPhoto(ctx, query)
    if err != nil {
        t.Fatalf("FAIL: expected no error, got %v", err)
    }

    if response == nil {
        t.Fatal("expected a search response, got nil")
    }
}
