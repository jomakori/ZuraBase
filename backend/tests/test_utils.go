package main

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"testing"
	"bytes"
)

// Get API base endpoint from environment variables or fallback
func getAPIEndpoint() string {
	if os.Getenv("DOCKER_ENV") == "true" {
		return "http://backend:8080"
	}
	v := os.Getenv("VITE_API_ENDPOINT")
	if v == "" {
		panic("VITE_API_ENDPOINT environment variable must be set for integration tests")
	}
	return v
}

// Helper to perform GET request
func doGetRequest[T any](ctx context.Context, t *testing.T, path string) *T {
	url := fmt.Sprintf("%s%s", getAPIEndpoint(), path)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		t.Fatalf("failed to create GET request: %v", err)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("failed GET request: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("unexpected response status: %s", resp.Status)
	}
	var result T
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	return &result
}

// Helper to perform POST request with JSON body
func doPostRequest[T any, V any](ctx context.Context, t *testing.T, path string, body V) *T {
	url := fmt.Sprintf("%s%s", getAPIEndpoint(), path)
	jsonBytes, err := json.Marshal(body)
	if err != nil {
		t.Fatalf("failed to marshal body: %v", err)
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(jsonBytes))
	if err != nil {
		t.Fatalf("failed to create POST request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("failed POST request: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("unexpected response status: %s", resp.Status)
	}
	var result T
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	return &result
}
