package tests

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"zurabase/internal/services"
)

// TestFirecrawlService_PromptDetection tests detection of prompt-like responses
func TestFirecrawlService_PromptDetection(t *testing.T) {
	// This is the problematic response that was being returned
	promptResponse := `{
		"success": true,
		"data": {
			"markdown": "# Summary The content provides instructions on how to format a response in markdown. It specifies that the response should include a summary of the content and a list of relevant tags...\n## Tags\n- Markdown\n- Formatting\n...",
			"title": "Prompt Response",
			"description": "This looks like a prompt"
		}
	}`
	
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(promptResponse))
	}))
	defer server.Close()

	fs := services.NewFirecrawlService("test-api-key", server.URL+"/v0")
	ctx := context.Background()
	content, _, _, err := fs.ExtractContent(ctx, "https://www.facebook.com/share/r/1FLa8nsWBy/")
	
	// After the fix, this should now return an error instead of the prompt content
	if err == nil {
		t.Error("ExtractContent should return error for prompt-like responses")
	}
	
	if !strings.Contains(err.Error(), "prompt") {
		t.Errorf("Error should mention prompt detection, got: %v", err)
	}
	
	// Content should be empty
	if content != "" {
		t.Errorf("Content should be empty for prompt responses, got: %q", content)
	}
	
	t.Logf("✅ Prompt detection working correctly: %v", err)
}

// TestFirecrawlService_FacebookURLHandling tests how Facebook URLs are handled
func TestFirecrawlService_FacebookURLHandling(t *testing.T) {
	// Simulate what Firecrawl might return for a Facebook share URL
	// Facebook share links often redirect to the actual content
	facebookResponse := `{
		"success": true,
		"data": {
			"markdown": "# Shared Article Title\n\nThis is the actual article content that was shared on Facebook.",
			"title": "Shared Article Title",
			"description": "An article shared on Facebook"
		}
	}`
	
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(facebookResponse))
	}))
	defer server.Close()

	fs := services.NewFirecrawlService("test-api-key", server.URL+"/v0")
	ctx := context.Background()
	content, title, description, err := fs.ExtractContent(ctx, "https://www.facebook.com/share/r/1FLa8nsWBy/")
	
	if err != nil {
		t.Fatalf("ExtractContent failed: %v", err)
	}
	
	if !strings.Contains(content, "Shared Article Title") {
		t.Error("Content should contain the shared article title")
	}
	
	if title != "Shared Article Title" {
		t.Errorf("Title mismatch: got %q", title)
	}
	
	if description != "An article shared on Facebook" {
		t.Errorf("Description mismatch: got %q", description)
	}
}

// TestFirecrawlService_RequestFormat tests the request format being sent
func TestFirecrawlService_RequestFormat(t *testing.T) {
	var capturedRequest []byte
	
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Capture the request body
		buf := make([]byte, r.ContentLength)
		r.Body.Read(buf)
		capturedRequest = buf
		
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{
			"success": true,
			"data": {
				"markdown": "Test content",
				"title": "Test",
				"description": "Test"
			}
		}`))
	}))
	defer server.Close()

	fs := services.NewFirecrawlService("test-api-key", server.URL+"/v0")
	ctx := context.Background()
	_, _, _, err := fs.ExtractContent(ctx, "https://example.com")
	
	if err != nil {
		t.Fatalf("ExtractContent failed: %v", err)
	}
	
	// Verify request format
	requestStr := string(capturedRequest)
	t.Logf("Captured request: %s", requestStr)
	
	if !strings.Contains(requestStr, "https://example.com") {
		t.Error("Request should contain the URL")
	}
	
	if !strings.Contains(requestStr, "markdown") {
		t.Error("Request should specify markdown format")
	}
	
	// Verify new parameters are being sent
	if !strings.Contains(requestStr, "onlyMainContent") {
		t.Error("Request should include onlyMainContent parameter")
	}
	
	if !strings.Contains(requestStr, "removeBase64Images") {
		t.Error("Request should include removeBase64Images parameter")
	}
	
	if !strings.Contains(requestStr, "timeout") {
		t.Error("Request should include timeout parameter")
	}
}

// TestFirecrawlService_APIEndpoint tests that we're using the correct endpoint
func TestFirecrawlService_APIEndpoint(t *testing.T) {
	var capturedPath string
	
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedPath = r.URL.Path
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{
			"success": true,
			"data": {
				"markdown": "Test",
				"title": "Test",
				"description": "Test"
			}
		}`))
	}))
	defer server.Close()

	fs := services.NewFirecrawlService("test-api-key", server.URL+"/v0")
	ctx := context.Background()
	_, _, _, err := fs.ExtractContent(ctx, "https://example.com")
	
	if err != nil {
		t.Fatalf("ExtractContent failed: %v", err)
	}
	
	// Verify endpoint
	if capturedPath != "/v0/scrape" {
		t.Errorf("Expected endpoint /v0/scrape, got %s", capturedPath)
	}
}

// TestFirecrawlService_AuthHeader tests that authorization header is set correctly
func TestFirecrawlService_AuthHeader(t *testing.T) {
	var capturedAuthHeader string
	
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedAuthHeader = r.Header.Get("Authorization")
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{
			"success": true,
			"data": {
				"markdown": "Test",
				"title": "Test",
				"description": "Test"
			}
		}`))
	}))
	defer server.Close()

	fs := services.NewFirecrawlService("my-secret-key", server.URL+"/v0")
	ctx := context.Background()
	_, _, _, err := fs.ExtractContent(ctx, "https://example.com")
	
	if err != nil {
		t.Fatalf("ExtractContent failed: %v", err)
	}
	
	// Verify auth header
	if capturedAuthHeader != "Bearer my-secret-key" {
		t.Errorf("Expected 'Bearer my-secret-key', got %q", capturedAuthHeader)
	}
}

// TestFirecrawlService_ResponseParsing tests response parsing
func TestFirecrawlService_ResponseParsing(t *testing.T) {
	testCases := []struct {
		name           string
		response       string
		expectedError  bool
		expectedTitle  string
		expectedDesc   string
	}{
		{
			name: "valid response",
			response: `{
				"success": true,
				"data": {
					"markdown": "# Title\n\nContent",
					"title": "Page Title",
					"description": "Page Description"
				}
			}`,
			expectedError: false,
			expectedTitle: "Page Title",
			expectedDesc:  "Page Description",
		},
		{
			name: "missing markdown field",
			response: `{
				"success": true,
				"data": {
					"title": "Page Title",
					"description": "Page Description"
				}
			}`,
			expectedError: false,
			expectedTitle: "Page Title",
			expectedDesc:  "Page Description",
		},
		{
			name: "error response",
			response: `{
				"success": false,
				"error": "Failed to scrape URL"
			}`,
			expectedError: true,
		},
		{
			name: "malformed JSON",
			response: `{invalid json}`,
			expectedError: true,
		},
	}
	
	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				w.Header().Set("Content-Type", "application/json")
				w.Write([]byte(tc.response))
			}))
			defer server.Close()

			fs := services.NewFirecrawlService("test-key", server.URL+"/v0")
			ctx := context.Background()
			_, title, desc, err := fs.ExtractContent(ctx, "https://example.com")
			
			if tc.expectedError && err == nil {
				t.Error("Expected error but got none")
			}
			if !tc.expectedError && err != nil {
				t.Errorf("Unexpected error: %v", err)
			}
			
			if !tc.expectedError {
				if title != tc.expectedTitle {
					t.Errorf("Title mismatch: got %q, expected %q", title, tc.expectedTitle)
				}
				if desc != tc.expectedDesc {
					t.Errorf("Description mismatch: got %q, expected %q", desc, tc.expectedDesc)
				}
			}
		})
	}
}
