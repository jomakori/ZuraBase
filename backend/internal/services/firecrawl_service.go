package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"
)

// FirecrawlService provides functionality to extract content from URLs using the Firecrawl API.
type FirecrawlService struct {
	apiKey     string
	baseURL    string
	httpClient *http.Client
	maxRetries int
}

// FirecrawlRequest represents the request payload for the Firecrawl scrape API.
type FirecrawlRequest struct {
	URL              string   `json:"url"`
	Formats          []string `json:"formats,omitempty"`
	IncludeHtmlTags  bool     `json:"includeHtmlTags,omitempty"`
	OnlyMainContent  bool     `json:"onlyMainContent,omitempty"`
	WaitFor          int      `json:"waitFor,omitempty"`
	Timeout          int      `json:"timeout,omitempty"`
	RemoveBase64Images bool   `json:"removeBase64Images,omitempty"`
}

// FirecrawlResponse represents the response from the Firecrawl API.
type FirecrawlResponse struct {
	Success bool   `json:"success"`
	Data    struct {
		Markdown    string `json:"markdown"`
		Title       string `json:"title"`
		Description string `json:"description"`
	} `json:"data"`
	Error string `json:"error"`
}

// ErrUnsupportedURL is returned when Firecrawl explicitly states a URL is unsupported.
type ErrUnsupportedURL struct {
	URL     string
	Message string
}

func (e *ErrUnsupportedURL) Error() string {
	return fmt.Sprintf("firecrawl unsupported URL %s: %s", e.URL, e.Message)
}

// NewFirecrawlService creates a new FirecrawlService with the provided API key and base URL.
// If baseURL is empty, defaults to "https://api.firecrawl.dev/v0".
func NewFirecrawlService(apiKey, baseURL string) *FirecrawlService {
	if baseURL == "" {
		baseURL = "https://api.firecrawl.dev/v0"
	}
	return &FirecrawlService{
		apiKey:     apiKey,
		baseURL:    strings.TrimSuffix(baseURL, "/"),
		httpClient: &http.Client{Timeout: 60 * time.Second},
		maxRetries: 3,
	}
}

// ExtractContent extracts content from a URL using Firecrawl.
// Returns extracted markdown content, title, description, and any error.
func (fs *FirecrawlService) ExtractContent(ctx context.Context, urlStr string) (string, string, string, error) {
	if urlStr == "" {
		return "", "", "", fmt.Errorf("URL cannot be empty")
	}

	var lastErr error
	for attempt := 0; attempt < fs.maxRetries; attempt++ {
		content, title, description, err := fs.extractContentOnce(ctx, urlStr)
		if err == nil {
			log.Printf("✅ Successfully extracted content from %s (attempt %d)", urlStr, attempt+1)
			return content, title, description, nil
		}
		lastErr = err
		// If it's an unsupported URL error, we don't retry.
		if _, ok := err.(*ErrUnsupportedURL); ok {
			log.Printf("❌ Unsupported URL, not retrying %s: %v", urlStr, err)
			return "", "", "", err
		}
		if !isRetryableError(err) {
			log.Printf("❌ Non-retryable error extracting %s: %v", urlStr, err)
			return "", "", "", err
		}
		log.Printf("⚠️ Attempt %d failed for %s: %v", attempt+1, urlStr, err)
		if attempt < fs.maxRetries-1 {
			backoff := time.Duration((1<<uint(attempt))*100) * time.Millisecond
			select {
			case <-time.After(backoff):
				log.Printf("⏳ Retrying after %v backoff", backoff)
			case <-ctx.Done():
				return "", "", "", ctx.Err()
			}
		}
	}
	log.Printf("❌ Failed to extract %s after %d retries: %v", urlStr, fs.maxRetries, lastErr)
	return "", "", "", fmt.Errorf("failed after %d retries: %w", fs.maxRetries, lastErr)
}

// extractContentOnce performs a single Firecrawl API call.
func (fs *FirecrawlService) extractContentOnce(ctx context.Context, urlStr string) (string, string, string, error) {
	req := FirecrawlRequest{
		URL:                urlStr,
		Formats:            []string{"markdown"},
		OnlyMainContent:    true,  // Extract only main content, ignore navigation/ads
		RemoveBase64Images: true, // Remove base64 encoded images to reduce noise
		Timeout:            30000, // 30 second timeout in milliseconds
	}
	jsonData, err := json.Marshal(req)
	if err != nil {
		return "", "", "", fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost,
		fmt.Sprintf("%s/scrape", fs.baseURL), bytes.NewBuffer(jsonData))
	if err != nil {
		return "", "", "", fmt.Errorf("failed to create request: %w", err)
	}
	httpReq.Header.Set("Authorization", fmt.Sprintf("Bearer %s", fs.apiKey))
	httpReq.Header.Set("Content-Type", "application/json")

	log.Printf("🔍 Sending Firecrawl request for URL: %s", urlStr)
	log.Printf("📤 Request body: %s", string(jsonData))
	resp, err := fs.httpClient.Do(httpReq)
	if err != nil {
		return "", "", "", fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", "", "", fmt.Errorf("failed to read response: %w", err)
	}

	log.Printf("📥 Raw Firecrawl response (status %d): %s", resp.StatusCode, string(body))

	var fcResp FirecrawlResponse
	if err := json.Unmarshal(body, &fcResp); err != nil {
		return "", "", "", fmt.Errorf("failed to parse response: %w", err)
	}

	if !fcResp.Success {
		// Check for the specific unsupported URL error from Firecrawl
		if resp.StatusCode == http.StatusForbidden && strings.Contains(fcResp.Error, "This website is not currently supported") {
			return "", "", "", &ErrUnsupportedURL{URL: urlStr, Message: fcResp.Error}
		}
		return "", "", "", fmt.Errorf("firecrawl error: %s", fcResp.Error)
	}

	content := fcResp.Data.Markdown
	log.Printf("✅ Extracted markdown length: %d chars, title: %q", len(content), fcResp.Data.Title)
	
	// Check if content looks like a prompt/instruction (suspicious pattern)
	if strings.Contains(strings.ToLower(content), "# summary") &&
	   strings.Contains(strings.ToLower(content), "## tags") &&
	   strings.Contains(strings.ToLower(content), "markdown") &&
	   strings.Contains(strings.ToLower(content), "formatting") {
		log.Printf("⚠️ WARNING: Content appears to be a prompt/instruction, not actual page content!")
		log.Printf("⚠️ This suggests Firecrawl may have returned its system prompt or default response")
		log.Printf("⚠️ URL: %s", urlStr)
		return "", "", "", fmt.Errorf("firecrawl returned prompt/instruction instead of page content for URL: %s", urlStr)
	}
	
	if len(content) > 5000 {
		content = content[:5000] + "\n[Content truncated...]"
	}

	return content, fcResp.Data.Title, fcResp.Data.Description, nil
}

// isRetryableError determines if an error is retryable based on its content.
func isRetryableError(err error) bool {
	if err == nil {
		return false
	}
	errStr := strings.ToLower(err.Error())
	retryablePatterns := []string{"timeout", "rate limit", "429", "503", "connection refused"}
	for _, pattern := range retryablePatterns {
		if strings.Contains(errStr, pattern) {
			return true
		}
	}
	return false
}
