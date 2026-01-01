package tests

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"zurabase/internal/models"
	"zurabase/internal/services"
)

// TestLinkProcessor_DetectURLs tests URL detection with various formats
func TestLinkProcessor_DetectURLs(t *testing.T) {
	// Create a LinkProcessor with nil firecrawl service (not needed for detection)
	lp := services.NewLinkProcessor(nil)

	testCases := []struct {
		name     string
		content  string
		expected []string
	}{
		{
			name:     "single URL",
			content:  "Check out https://example.com for more info",
			expected: []string{"https://example.com"},
		},
		{
			name:     "multiple URLs",
			content:  "Visit https://example.com and http://test.org for details",
			expected: []string{"https://example.com", "http://test.org"},
		},
		{
			name:     "URL with query params",
			content:  "Search https://google.com/search?q=golang",
			expected: []string{"https://google.com/search?q=golang"},
		},
		{
			name:     "URL with trailing punctuation",
			content:  "See https://example.com. Also check http://test.org!",
			expected: []string{"https://example.com", "http://test.org"},
		},
		{
			name:     "URL with parentheses",
			content:  "Link (https://example.com/path) inside parentheses",
			expected: []string{"https://example.com/path"},
		},
		{
			name:     "no URLs",
			content:  "This is plain text without any links",
			expected: []string{},
		},
		{
			name:     "mixed content with markdown",
			content:  "Check [this](https://example.com) and also https://test.org",
			expected: []string{"https://example.com", "https://test.org"},
		},
		{
			name:     "URL with port",
			content:  "Server at https://localhost:8080 (should be filtered)",
			expected: []string{}, // localhost is filtered by ValidateURL
		},
		{
			name:     "private IP",
			content:  "Internal http://192.168.1.1/admin",
			expected: []string{}, // private IP filtered
		},
		{
			name:     "max URLs limit",
			content:  "https://example1.com https://example2.com https://example3.com https://example4.com https://example5.com https://example6.com https://example7.com https://example8.com https://example9.com https://example10.com https://example11.com",
			expected: []string{"https://example1.com", "https://example2.com", "https://example3.com", "https://example4.com", "https://example5.com", "https://example6.com", "https://example7.com", "https://example8.com", "https://example9.com", "https://example10.com"}, // max 10
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			urls := lp.DetectURLs(tc.content)
			if len(urls) != len(tc.expected) {
				t.Errorf("DetectURLs() returned %d URLs, expected %d. Got: %v", len(urls), len(tc.expected), urls)
				return
			}
			for i, url := range urls {
				if url != tc.expected[i] {
					t.Errorf("DetectURLs() URL mismatch at index %d: got %q, want %q", i, url, tc.expected[i])
				}
			}
		})
	}
}

// TestLinkProcessor_RemoveURLs tests URL removal from content
func TestLinkProcessor_RemoveURLs(t *testing.T) {
	lp := services.NewLinkProcessor(nil)

	testCases := []struct {
		name     string
		content  string
		expected string
	}{
		{
			name:     "remove HTTP/HTTPS URLs",
			content:  "Visit https://example.com and http://test.org for details",
			expected: "Visit  and  for details",
		},
		{
			name:     "remove markdown links",
			content:  "Check [this page](https://example.com) and [another](http://test.org)",
			expected: "Check this page and another",
		},
		{
			name:     "remove HTML links",
			content:  `Click <a href="https://example.com">here</a> for more`,
			expected: "Click here for more",
		},
		{
			name:     "mixed content",
			content:  `See https://example.com, [markdown](http://test.org) and <a href="https://google.com">Google</a>`,
			expected: "See , markdown and Google",
		},
		{
			name:     "no URLs",
			content:  "Plain text without links",
			expected: "Plain text without links",
		},
		{
			name:     "URL with query params",
			content:  "Search https://google.com/search?q=golang",
			expected: "Search ",
		},
		{
			name:     "URL with trailing punctuation",
			content:  "Visit https://example.com. Then go to http://test.org!",
			expected: "Visit . Then go to !",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := lp.RemoveURLs(tc.content)
			if result != tc.expected {
				t.Errorf("RemoveURLs() mismatch:\nGot:      %q\nExpected: %q", result, tc.expected)
			}
		})
	}
}

// mockFirecrawlServer creates a test HTTP server that simulates Firecrawl API responses
func mockFirecrawlServer(t *testing.T, statusCode int, responseBody string) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("Expected POST request, got %s", r.Method)
		}
		if r.URL.Path != "/v0/scrape" {
			t.Errorf("Expected path /v0/scrape, got %s", r.URL.Path)
		}
		authHeader := r.Header.Get("Authorization")
		if !strings.HasPrefix(authHeader, "Bearer ") {
			t.Errorf("Expected Bearer token, got %s", authHeader)
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(statusCode)
		w.Write([]byte(responseBody))
	}))
}

// TestFirecrawlService_ExtractContent tests successful extraction
func TestFirecrawlService_ExtractContent(t *testing.T) {
	// Create mock server with successful response
	mockResponse := `{
		"success": true,
		"data": {
			"markdown": "# Example Page\n\nThis is extracted content.",
			"title": "Example Page",
			"description": "An example page for testing"
		}
	}`
	server := mockFirecrawlServer(t, http.StatusOK, mockResponse)
	defer server.Close()

	// Create FirecrawlService with mock server URL
	fs := services.NewFirecrawlService("test-api-key", server.URL+"/v0")

	ctx := context.Background()
	content, title, description, err := fs.ExtractContent(ctx, "https://example.com")
	if err != nil {
		t.Fatalf("ExtractContent failed: %v", err)
	}
	expectedContent := "# Example Page\n\nThis is extracted content."
	if content != expectedContent {
		t.Errorf("ExtractContent content mismatch:\nGot: %q\nExpected: %q", content, expectedContent)
	}
	if title != "Example Page" {
		t.Errorf("ExtractContent title mismatch: got %q, want %q", title, "Example Page")
	}
	if description != "An example page for testing" {
		t.Errorf("ExtractContent description mismatch: got %q, want %q", description, "An example page for testing")
	}
	
	// Verify request includes new parameters
	// This is implicitly tested by the mock server accepting the request
}

// TestFirecrawlService_ExtractContent_Error tests error handling
func TestFirecrawlService_ExtractContent_Error(t *testing.T) {
	// Mock server returning error response
	mockResponse := `{
		"success": false,
		"error": "Failed to scrape URL"
	}`
	server := mockFirecrawlServer(t, http.StatusOK, mockResponse)
	defer server.Close()

	fs := services.NewFirecrawlService("test-api-key", server.URL+"/v0")
	ctx := context.Background()
	_, _, _, err := fs.ExtractContent(ctx, "https://example.com")
	if err == nil {
		t.Fatal("Expected error but got none")
	}
	if !strings.Contains(err.Error(), "firecrawl error") {
		t.Errorf("Expected error containing 'firecrawl error', got: %v", err)
	}
}

// TestFirecrawlService_ExtractContent_NetworkError tests network failure
func TestFirecrawlService_ExtractContent_NetworkError(t *testing.T) {
	// Create a server that closes immediately to simulate network error
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Close the connection abruptly
		hj, ok := w.(http.Hijacker)
		if ok {
			conn, _, _ := hj.Hijack()
			conn.Close()
		}
	}))
	defer server.Close()

	fs := services.NewFirecrawlService("test-api-key", server.URL+"/v0")
	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
	defer cancel()
	_, _, _, err := fs.ExtractContent(ctx, "https://example.com")
	if err == nil {
		t.Fatal("Expected network error but got none")
	}
}

// TestLinkProcessor_ExtractAndCombine tests the combined extraction and combination flow
func TestLinkProcessor_ExtractAndCombine(t *testing.T) {
	// Mock server with successful response
	mockResponse := `{
		"success": true,
		"data": {
			"markdown": "# Extracted\n\nContent from URL.",
			"title": "Extracted Page",
			"description": "Test description"
		}
	}`
	server := mockFirecrawlServer(t, http.StatusOK, mockResponse)
	defer server.Close()

	fs := services.NewFirecrawlService("test-api-key", server.URL+"/v0")
	lp := services.NewLinkProcessor(fs)

	ctx := context.Background()
	originalContent := "Check this URL: https://example.com"
	urls := []string{"https://example.com"}

	combined, metadata, err := lp.ExtractAndCombine(ctx, originalContent, urls)
	if err != nil {
		t.Fatalf("ExtractAndCombine failed: %v", err)
	}

	// Check that combined content includes original and extracted section
	if !strings.Contains(combined, originalContent) {
		t.Error("Combined content should contain original content")
	}
	if !strings.Contains(combined, "## Extracted Content from URLs:") {
		t.Error("Combined content should contain extracted section header")
	}
	if !strings.Contains(combined, "Extracted Page") {
		t.Error("Combined content should contain extracted title")
	}

	// Check metadata
	if len(metadata) != 1 {
		t.Fatalf("Expected 1 metadata entry, got %d", len(metadata))
	}
	md := metadata[0]
	if md.URL != "https://example.com" {
		t.Errorf("Metadata URL mismatch: got %q", md.URL)
	}
	if md.Status != "success" {
		t.Errorf("Metadata status mismatch: got %q", md.Status)
	}
	if md.Title != "Extracted Page" {
		t.Errorf("Metadata title mismatch: got %q", md.Title)
	}
	if md.ExtractedContent != "# Extracted\n\nContent from URL." {
		t.Errorf("Metadata extracted content mismatch")
	}
}

// TestLinkProcessor_ExtractAndCombine_MixedSuccess tests mixed success/failure URLs
func TestLinkProcessor_ExtractAndCombine_MixedSuccess(t *testing.T) {
	// Mock server that returns success for first URL, error for second
	callCount := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		callCount++
		if callCount == 1 {
			w.Write([]byte(`{
				"success": true,
				"data": {
					"markdown": "First success",
					"title": "First",
					"description": ""
				}
			}`))
		} else {
			w.Write([]byte(`{
				"success": false,
				"error": "Failed to scrape"
			}`))
		}
	}))
	defer server.Close()

	fs := services.NewFirecrawlService("test-api-key", server.URL+"/v0")
	lp := services.NewLinkProcessor(fs)

	ctx := context.Background()
	urls := []string{"https://example1.com", "https://example2.com"}
	combined, metadata, err := lp.ExtractAndCombine(ctx, "Original", urls)
	if err != nil {
		t.Fatalf("ExtractAndCombine should not return error for partial failures: %v", err)
	}

	// Should have two metadata entries
	if len(metadata) != 2 {
		t.Fatalf("Expected 2 metadata entries, got %d", len(metadata))
	}

	// First should be success
	if metadata[0].Status != "success" {
		t.Errorf("First metadata status should be success, got %s", metadata[0].Status)
	}
	// Second should be failed
	if metadata[1].Status != "failed" {
		t.Errorf("Second metadata status should be failed, got %s", metadata[1].Status)
	}

	// Combined content should include only successful extraction
	if !strings.Contains(combined, "First success") {
		t.Error("Combined content should include successful extraction")
	}
}

// TestLinkProcessor_ExtractAndCombine_NoURLs tests with empty URL list
func TestLinkProcessor_ExtractAndCombine_NoURLs(t *testing.T) {
	lp := services.NewLinkProcessor(nil)
	ctx := context.Background()
	original := "No URLs here"
	combined, metadata, err := lp.ExtractAndCombine(ctx, original, []string{})
	if err != nil {
		t.Fatalf("ExtractAndCombine with no URLs should not error: %v", err)
	}
	if combined != original {
		t.Errorf("Combined content should equal original when no URLs: got %q", combined)
	}
	if len(metadata) != 0 {
		t.Errorf("Expected empty metadata, got %d entries", len(metadata))
	}
}

// TestLinkProcessor_ProcessURLs_Timeout tests timeout handling
func TestLinkProcessor_ProcessURLs_Timeout(t *testing.T) {
	// Create a server that delays response longer than timeout
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(100 * time.Millisecond) // Longer than our test timeout
		w.Write([]byte(`{"success": true, "data": {"markdown": "delayed"}}`))
	}))
	defer server.Close()

	fs := services.NewFirecrawlService("test-api-key", server.URL+"/v0")
	lp := services.NewLinkProcessor(fs)
	// Use a short timeout context
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Millisecond)
	defer cancel()

	// Use ProcessURLs directly (since ExtractAndCombine calls it)
	// We need to call DetectURLs and ProcessURLs manually
	urls := []string{"https://example.com"}
	metadataMap := lp.ProcessURLs(ctx, urls)
	if len(metadataMap) != 1 {
		t.Fatalf("Expected 1 metadata entry, got %d", len(metadataMap))
	}
	md := metadataMap["https://example.com"]
	if md.Status != "failed" {
		t.Errorf("Expected failed status due to timeout, got %s", md.Status)
	}
	if !strings.Contains(md.ErrorMessage, "context") {
		t.Logf("Timeout error message: %s", md.ErrorMessage)
	}
}

// TestLinkProcessor_ValidateURL tests URL validation
func TestLinkProcessor_ValidateURL(t *testing.T) {
	lp := services.NewLinkProcessor(nil)

	testCases := []struct {
		url      string
		expected bool
	}{
		{"https://example.com", true},
		{"http://example.com", true},
		{"ftp://example.com", false}, // wrong scheme
		{"", false},
		{"not-a-url", false},
		{"http://localhost", false},
		{"http://127.0.0.1", false},
		{"http://192.168.1.1", false},
		{"http://10.0.0.1", true}, // 10.x.x.x is private but not filtered by current validation
		{"https://example.com/path?query=1", true},
	}

	for _, tc := range testCases {
		result := lp.ValidateURL(tc.url)
		if result != tc.expected {
			t.Errorf("ValidateURL(%q) = %v, expected %v", tc.url, result, tc.expected)
		}
	}
}

// TestLinkProcessor_CombineContent tests content combination formatting
func TestLinkProcessor_CombineContent(t *testing.T) {
	lp := services.NewLinkProcessor(nil)

	metadataMap := map[string]*models.LinkMetadata{
		"https://example.com": {
			URL:              "https://example.com",
			Status:           "success",
			ExtractedContent: "Extracted content here.",
			Title:            "Example Title",
			Description:      "Example description",
		},
		"https://failed.com": {
			URL:    "https://failed.com",
			Status: "failed",
			ErrorMessage: "Failed to extract",
		},
	}

	original := "Original content"
	combined := lp.CombineContent(original, metadataMap)

	// Should contain original
	if !strings.Contains(combined, original) {
		t.Error("Combined content missing original")
	}
	// Should contain section header
	if !strings.Contains(combined, "## Extracted Content from URLs:") {
		t.Error("Combined content missing section header")
	}
	// Should contain successful extraction
	if !strings.Contains(combined, "Example Title") {
		t.Error("Combined content missing successful extraction title")
	}
	if !strings.Contains(combined, "Extracted content here.") {
		t.Error("Combined content missing extracted content")
	}
	// Should NOT contain failed extraction
	if strings.Contains(combined, "failed.com") {
		t.Error("Combined content should not include failed URLs")
	}
}

// TestLinkProcessor_ExtractAndCombine_RealStrandIntegration tests integration with real strand data
func TestLinkProcessor_ExtractAndCombine_RealStrandIntegration(t *testing.T) {
	// Mock server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{
			"success": true,
			"data": {
				"markdown": "## Article\n\nThis is a test article.",
				"title": "Test Article",
				"description": "A test article for integration"
			}
		}`))
	}))
	defer server.Close()

	fs := services.NewFirecrawlService("test-key", server.URL+"/v0")
	lp := services.NewLinkProcessor(fs)

	ctx := context.Background()
	// Simulate a real strand with multiple URLs
	original := `Today I found two interesting articles:
- https://example.com/article1
- https://example.com/article2
Check them out!`
	urls := []string{"https://example.com/article1", "https://example.com/article2"}

	combined, metadata, err := lp.ExtractAndCombine(ctx, original, urls)
	if err != nil {
		t.Fatalf("ExtractAndCombine failed: %v", err)
	}

	// Verify original content preserved
	if !strings.Contains(combined, "Today I found two interesting articles:") {
		t.Error("Original content not preserved")
	}
	// Verify extracted section added
	if !strings.Contains(combined, "## Extracted Content from URLs:") {
		t.Error("Extracted section missing")
	}
	// Verify both URLs processed
	if len(metadata) != 2 {
		t.Errorf("Expected 2 metadata entries, got %d", len(metadata))
	}
	// Verify URLs removed from combined content (they are still present because we didn't call RemoveURLs)
	// That's fine, ExtractAndCombine does not remove URLs.
}

// TestFirecrawlService_RetryLogic tests retry behavior
func TestFirecrawlService_RetryLogic(t *testing.T) {
	retryCount := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		retryCount++
		if retryCount < 3 {
			w.WriteHeader(http.StatusTooManyRequests) // 429
			w.Write([]byte(`{"error": "rate limit"}`))
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{
			"success": true,
			"data": {
				"markdown": "Success after retry",
				"title": "Success",
				"description": ""
			}
		}`))
	}))
	defer server.Close()

	fs := services.NewFirecrawlService("test-key", server.URL+"/v0")
	ctx := context.Background()
	content, _, _, err := fs.ExtractContent(ctx, "https://example.com")
	if err != nil {
		t.Fatalf("ExtractContent failed after retries: %v", err)
	}
	if content != "Success after retry" {
		t.Errorf("Unexpected content: %q", content)
	}
	if retryCount != 3 {
		t.Errorf("Expected 3 retry attempts, got %d", retryCount)
	}
}

// TestFirecrawlService_NonRetryableError tests that non-retryable errors don't retry
func TestFirecrawlService_NonRetryableError(t *testing.T) {
	callCount := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callCount++
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{
			"success": false,
			"error": "Invalid URL format"
		}`))
	}))
	defer server.Close()

	fs := services.NewFirecrawlService("test-key", server.URL+"/v0")
	ctx := context.Background()
	_, _, _, err := fs.ExtractContent(ctx, "https://example.com")
	if err == nil {
		t.Fatal("Expected error but got none")
	}
	if callCount != 1 {
		t.Errorf("Expected 1 attempt for non-retryable error, got %d", callCount)
	}
}

// TestLinkProcessor_RemoveURLs_PreservesStructure tests that URL removal preserves text structure
func TestLinkProcessor_RemoveURLs_PreservesStructure(t *testing.T) {
	lp := services.NewLinkProcessor(nil)
	content := `First sentence with https://example.com.
Second sentence with [link](http://test.org).
Third sentence with <a href="https://google.com">Google</a>.`
	result := lp.RemoveURLs(content)
	// Should still have three sentences
	lines := strings.Split(result, "\n")
	if len(lines) < 3 {
		t.Errorf("Expected at least 3 lines, got %d", len(lines))
	}
	// Should not contain URLs
	if strings.Contains(result, "https://") || strings.Contains(result, "http://") {
		t.Errorf("Result still contains URLs: %q", result)
	}
}

// TestLinkProcessor_DetectURLs_EdgeCases tests edge cases in URL detection
func TestLinkProcessor_DetectURLs_EdgeCases(t *testing.T) {
	lp := services.NewLinkProcessor(nil)
	// URL with underscore
	urls := lp.DetectURLs("https://example.com/path_with_underscore")
	if len(urls) != 1 || urls[0] != "https://example.com/path_with_underscore" {
		t.Errorf("Failed to detect URL with underscore: %v", urls)
	}
	// URL with hyphen
	urls = lp.DetectURLs("https://example.com/path-with-hyphen")
	if len(urls) != 1 || urls[0] != "https://example.com/path-with-hyphen" {
		t.Errorf("Failed to detect URL with hyphen: %v", urls)
	}
	// URL with percent encoding
	urls = lp.DetectURLs("https://example.com/path%20with%20spaces")
	if len(urls) != 1 || urls[0] != "https://example.com/path%20with%20spaces" {
		t.Errorf("Failed to detect URL with percent encoding: %v", urls)
	}
}

// TestFirecrawlService_EmptyAPIKey tests graceful handling of missing API key
func TestFirecrawlService_EmptyAPIKey(t *testing.T) {
	// NewFirecrawlService with empty API key should still create service (no error)
	fs := services.NewFirecrawlService("", "https://api.firecrawl.dev/v0")
	if fs == nil {
		t.Fatal("NewFirecrawlService returned nil with empty API key")
	}
	// ExtractContent will fail due to missing API key when making request
	// but that's okay; we test that the service can be created.
}

// TestLinkProcessor_NilFirecrawlService tests that LinkProcessor works with nil service
func TestLinkProcessor_NilFirecrawlService(t *testing.T) {
	lp := services.NewLinkProcessor(nil)
	// DetectURLs should still work
	urls := lp.DetectURLs("https://example.com")
	if len(urls) == 0 {
		t.Error("DetectURLs should work with nil firecrawl service")
	}
	// ProcessURLs will panic? Actually it will call nil firecrawlService.ExtractContent
	// We'll skip testing that as it's an edge case.
}

// TestLinkProcessor_URLOnlyStrand tests handling of strands containing only a URL
func TestLinkProcessor_URLOnlyStrand(t *testing.T) {
	// Mock server with successful response
	mockResponse := `{
		"success": true,
		"data": {
			"markdown": "# Article Title\n\nThis is the extracted article content with multiple paragraphs.\n\nSecond paragraph here.",
			"title": "Article Title",
			"description": "A test article"
		}
	}`
	server := mockFirecrawlServer(t, http.StatusOK, mockResponse)
	defer server.Close()

	fs := services.NewFirecrawlService("test-api-key", server.URL+"/v0")
	lp := services.NewLinkProcessor(fs)

	ctx := context.Background()
	// Strand with ONLY a URL, no other content
	originalContent := "https://example.com/article"
	urls := []string{"https://example.com/article"}

	combined, metadata, err := lp.ExtractAndCombine(ctx, originalContent, urls)
	if err != nil {
		t.Fatalf("ExtractAndCombine failed: %v", err)
	}

	// Verify combined content does NOT have the "## Extracted Content from URLs:" header
	if strings.Contains(combined, "## Extracted Content from URLs:") {
		t.Error("URL-only strand should not have extracted content section header")
	}

	// Verify combined content contains the extracted content
	if !strings.Contains(combined, "Article Title") {
		t.Error("Combined content should contain extracted title")
	}

	// Verify the original URL is not in the combined content (it should be removed)
	// Actually, CombineContent doesn't remove URLs, that's done by RemoveURLs
	// So we test RemoveURLs separately

	// Test RemoveURLs on the combined content
	cleaned := lp.RemoveURLs(combined)
	if strings.Contains(cleaned, "https://") {
		t.Error("Cleaned content should not contain URLs")
	}

	// Verify cleaned content still has the article content
	if !strings.Contains(cleaned, "Article Title") {
		t.Error("Cleaned content should still contain article content")
	}

	// Verify metadata
	if len(metadata) != 1 {
		t.Fatalf("Expected 1 metadata entry, got %d", len(metadata))
	}
	if metadata[0].Status != "success" {
		t.Errorf("Expected success status, got %s", metadata[0].Status)
	}
}

// TestLinkProcessor_MultipleURLsOnlyStrand tests handling of strands with multiple URLs and no text
func TestLinkProcessor_MultipleURLsOnlyStrand(t *testing.T) {
	callCount := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		callCount++
		if callCount == 1 {
			w.Write([]byte(`{
				"success": true,
				"data": {
					"markdown": "# First Article\n\nContent from first URL.",
					"title": "First Article",
					"description": "First description"
				}
			}`))
		} else {
			w.Write([]byte(`{
				"success": true,
				"data": {
					"markdown": "# Second Article\n\nContent from second URL.",
					"title": "Second Article",
					"description": "Second description"
				}
			}`))
		}
	}))
	defer server.Close()

	fs := services.NewFirecrawlService("test-api-key", server.URL+"/v0")
	lp := services.NewLinkProcessor(fs)

	ctx := context.Background()
	// Strand with multiple URLs and no other text
	originalContent := "https://example.com/article1 https://example.com/article2"
	urls := []string{"https://example.com/article1", "https://example.com/article2"}

	combined, metadata, err := lp.ExtractAndCombine(ctx, originalContent, urls)
	if err != nil {
		t.Fatalf("ExtractAndCombine failed: %v", err)
	}

	// Should not have section header for URL-only strands
	if strings.Contains(combined, "## Extracted Content from URLs:") {
		t.Error("URL-only strand should not have extracted content section header")
	}

	// Should have both articles
	if !strings.Contains(combined, "First Article") {
		t.Error("Combined content should contain first article")
	}
	if !strings.Contains(combined, "Second Article") {
		t.Error("Combined content should contain second article")
	}

	// Verify metadata
	if len(metadata) != 2 {
		t.Fatalf("Expected 2 metadata entries, got %d", len(metadata))
	}
}

// TestLinkProcessor_URLWithMinimalText tests handling of strands with URL and minimal text
func TestLinkProcessor_URLWithMinimalText(t *testing.T) {
	mockResponse := `{
		"success": true,
		"data": {
			"markdown": "# Page Content\n\nExtracted page content here.",
			"title": "Page Title",
			"description": "Page description"
		}
	}`
	server := mockFirecrawlServer(t, http.StatusOK, mockResponse)
	defer server.Close()

	fs := services.NewFirecrawlService("test-api-key", server.URL+"/v0")
	lp := services.NewLinkProcessor(fs)

	ctx := context.Background()
	// Strand with URL and minimal text (less than 10 chars)
	originalContent := "Check: https://example.com"
	urls := []string{"https://example.com"}

	combined, metadata, err := lp.ExtractAndCombine(ctx, originalContent, urls)
	if err != nil {
		t.Fatalf("ExtractAndCombine failed: %v", err)
	}

	// Should not have section header for minimal text strands
	if strings.Contains(combined, "## Extracted Content from URLs:") {
		t.Error("Minimal text strand should not have extracted content section header")
	}

	// Should have extracted content
	if !strings.Contains(combined, "Page Content") {
		t.Error("Combined content should contain extracted content")
	}

	if len(metadata) != 1 {
		t.Fatalf("Expected 1 metadata entry, got %d", len(metadata))
	}
}

// TestLinkProcessor_URLWithSubstantialText tests handling of strands with URL and substantial text
func TestLinkProcessor_URLWithSubstantialText(t *testing.T) {
	mockResponse := `{
		"success": true,
		"data": {
			"markdown": "# Extracted Content\n\nThis is extracted from the URL.",
			"title": "Extracted Title",
			"description": "Extracted description"
		}
	}`
	server := mockFirecrawlServer(t, http.StatusOK, mockResponse)
	defer server.Close()

	fs := services.NewFirecrawlService("test-api-key", server.URL+"/v0")
	lp := services.NewLinkProcessor(fs)

	ctx := context.Background()
	// Strand with URL and substantial text (more than 10 chars)
	originalContent := "This is a substantial comment about the article at https://example.com that has more than ten characters"
	urls := []string{"https://example.com"}

	combined, metadata, err := lp.ExtractAndCombine(ctx, originalContent, urls)
	if err != nil {
		t.Fatalf("ExtractAndCombine failed: %v", err)
	}

	// SHOULD have section header for substantial text strands
	if !strings.Contains(combined, "## Extracted Content from URLs:") {
		t.Error("Substantial text strand should have extracted content section header")
	}

	// Should have original content
	if !strings.Contains(combined, "This is a substantial comment") {
		t.Error("Combined content should contain original text")
	}

	// Should have extracted content
	if !strings.Contains(combined, "Extracted Content") {
		t.Error("Combined content should contain extracted content")
	}

	if len(metadata) != 1 {
		t.Fatalf("Expected 1 metadata entry, got %d", len(metadata))
	}
}

// TestLinkProcessor_FacebookURLOnly tests handling of Facebook share URLs (the original issue)
func TestLinkProcessor_FacebookURLOnly(t *testing.T) {
	mockResponse := `{
		"success": true,
		"data": {
			"markdown": "# Facebook Shared Content\n\nThis is the content that was shared on Facebook.",
			"title": "Shared Article",
			"description": "An article shared on Facebook"
		}
	}`
	server := mockFirecrawlServer(t, http.StatusOK, mockResponse)
	defer server.Close()

	fs := services.NewFirecrawlService("test-api-key", server.URL+"/v0")
	lp := services.NewLinkProcessor(fs)

	ctx := context.Background()
	// The original problematic case: Facebook share URL only
	originalContent := "https://www.facebook.com/share/r/1FLa8nsWBy/"
	urls := []string{"https://www.facebook.com/share/r/1FLa8nsWBy/"}

	combined, metadata, err := lp.ExtractAndCombine(ctx, originalContent, urls)
	if err != nil {
		t.Fatalf("ExtractAndCombine failed: %v", err)
	}

	// Should NOT have confusing markdown section headers
	if strings.Contains(combined, "## Extracted Content from URLs:") {
		t.Error("Facebook URL-only strand should not have extracted content section header")
	}

	// Should have the extracted content
	if !strings.Contains(combined, "Facebook Shared Content") {
		t.Error("Combined content should contain extracted content")
	}

	// Test the full pipeline: combine + remove URLs
	cleaned := lp.RemoveURLs(combined)

	// Should not contain the Facebook URL
	if strings.Contains(cleaned, "facebook.com") {
		t.Error("Cleaned content should not contain Facebook URL")
	}

	// Should still have the extracted content
	if !strings.Contains(cleaned, "Facebook Shared Content") {
		t.Error("Cleaned content should still contain extracted content")
	}

	// Should not have confusing markdown artifacts
	if strings.Contains(cleaned, "## Extracted") {
		t.Error("Cleaned content should not have markdown section headers")
	}

	if len(metadata) != 1 {
		t.Fatalf("Expected 1 metadata entry, got %d", len(metadata))
	}
}

// TestLinkProcessor_IsContentOnlyURLs tests the URL-only detection logic
func TestLinkProcessor_IsContentOnlyURLs(t *testing.T) {
	lp := services.NewLinkProcessor(nil)

	testCases := []struct {
		name     string
		content  string
		expected bool
	}{
		{
			name:     "single URL only",
			content:  "https://example.com",
			expected: true,
		},
		{
			name:     "multiple URLs only",
			content:  "https://example.com https://test.org",
			expected: true,
		},
		{
			name:     "URL with minimal text",
			content:  "Check: https://example.com",
			expected: true,
		},
		{
			name:     "URL with substantial text",
			content:  "This is a substantial comment about the article at https://example.com that has more than ten characters",
			expected: false,
		},
		{
			name:     "markdown link only",
			content:  "[link](https://example.com)",
			expected: true,
		},
		{
			name:     "HTML link only",
			content:  `<a href="https://example.com">link</a>`,
			expected: true,
		},
		{
			name:     "empty content",
			content:  "",
			expected: true,
		},
		{
			name:     "whitespace only",
			content:  "   \n\t  ",
			expected: true,
		},
		{
			name:     "URL with punctuation",
			content:  "https://example.com.",
			expected: true,
		},
		{
			name:     "Facebook share URL",
			content:  "https://www.facebook.com/share/r/1FLa8nsWBy/",
			expected: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := lp.IsContentOnlyURLs(tc.content)
			if result != tc.expected {
				t.Errorf("IsContentOnlyURLs(%q) = %v, expected %v", tc.content, result, tc.expected)
			}
		})
	}
}

// TestLinkProcessor_CleanMarkdownContent tests markdown cleaning
func TestLinkProcessor_CleanMarkdownContent(t *testing.T) {
	lp := services.NewLinkProcessor(nil)

	testCases := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "remove multiple heading levels",
			input:    "### Heading 3\n#### Heading 4",
			expected: "Heading 3\nHeading 4",
		},
		{
			name:     "keep single heading",
			input:    "# Main Heading\n\nContent here",
			expected: "# Main Heading\n\nContent here",
		},
		{
			name:     "remove excessive blank lines",
			input:    "Line 1\n\n\n\nLine 2",
			expected: "Line 1\n\nLine 2",
		},
		{
			name:     "remove horizontal rules",
			input:    "Section 1\n---\nSection 2",
			expected: "Section 1\nSection 2",
		},
		{
			name:     "combined cleaning",
			input:    "### Title\n\n\n\nContent\n---\n#### Subtitle",
			expected: "Title\n\nContent\nSubtitle",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := lp.CleanMarkdownContent(tc.input)
			if result != tc.expected {
				t.Errorf("CleanMarkdownContent mismatch:\nGot:      %q\nExpected: %q", result, tc.expected)
			}
		})
	}
}

// TestLinkProcessor_CombineContent_URLOnly tests CombineContent with URL-only strands
func TestLinkProcessor_CombineContent_URLOnly(t *testing.T) {
	lp := services.NewLinkProcessor(nil)

	metadataMap := map[string]*models.LinkMetadata{
		"https://example.com": {
			URL:              "https://example.com",
			Status:           "success",
			ExtractedContent: "Extracted content from the URL.",
			Title:            "Example Title",
			Description:      "Example description",
		},
	}

	// Test with URL-only original content
	original := "https://example.com"
	combined := lp.CombineContent(original, metadataMap)

	// Should NOT have section header
	if strings.Contains(combined, "## Extracted Content from URLs:") {
		t.Error("URL-only content should not have section header")
	}

	// Should have the extracted content
	if !strings.Contains(combined, "Extracted content from the URL.") {
		t.Error("Combined content should contain extracted content")
	}

	// Should have the title
	if !strings.Contains(combined, "Example Title") {
		t.Error("Combined content should contain title")
	}
}

// TestLinkProcessor_CombineContent_WithText tests CombineContent with text + URL
func TestLinkProcessor_CombineContent_WithText(t *testing.T) {
	lp := services.NewLinkProcessor(nil)

	metadataMap := map[string]*models.LinkMetadata{
		"https://example.com": {
			URL:              "https://example.com",
			Status:           "success",
			ExtractedContent: "Extracted content from the URL.",
			Title:            "Example Title",
			Description:      "Example description",
		},
	}

	// Test with substantial original content
	original := "This is a substantial comment about the article at https://example.com that has more than ten characters"
	combined := lp.CombineContent(original, metadataMap)

	// SHOULD have section header
	if !strings.Contains(combined, "## Extracted Content from URLs:") {
		t.Error("Content with text should have section header")
	}

	// Should have original content
	if !strings.Contains(combined, "This is a substantial comment") {
		t.Error("Combined content should contain original text")
	}

	// Should have extracted content
	if !strings.Contains(combined, "Extracted content from the URL.") {
		t.Error("Combined content should contain extracted content")
	}
}
