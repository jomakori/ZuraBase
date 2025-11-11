package services

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"time"

	"net/url"
	"strings"
	"zurabase/models"
)

// AIClient provides methods to interact with LLM services directly
// Implements LLMClient interface
type AIClient struct {
	ServerURL  string
	Model      string
	APIKey     string
	HTTPClient *http.Client
	UserID     string
	ProfileID  string
}

// AIAnalysisRequest represents the request to analyze content
type AIAnalysisRequest struct {
	Content string `json:"content"`
	Source  string `json:"source,omitempty"`
}

// AIAnalysisResponse represents the response from the AI service
type AIAnalysisResponse struct {
	Tags        []string `json:"tags"`
	Summary     string   `json:"summary"`
	RelatedIDs  []string `json:"related_ids,omitempty"`
	Topics      []string `json:"topics,omitempty"`
	Keywords    []string `json:"keywords,omitempty"`
	Error       string   `json:"error,omitempty"`
	ProcessedAt string   `json:"processed_at"`
}

// NewAIClient creates a new AI client with the provided configuration
// It will try to use the default LLM profile if available, otherwise fall back to environment variables
func NewAIClient() (*AIClient, error) {
	return NewAIClientWithUserID("")
}

// NewAIClientWithUserID creates a new AI client for a specific user
// It will try to use the user's default LLM profile if available
func NewAIClientWithUserID(userID string) (*AIClient, error) {
	log.Printf("🔍 NewAIClientWithUserID: Starting AI client creation for user %s", userID)

	httpClient := &http.Client{Timeout: 30 * time.Second}
	client := &AIClient{HTTPClient: httpClient, UserID: userID}

	if userID == "" {
		log.Printf("❌ NewAIClientWithUserID: userID is required for user-specific AI clients")
		return nil, errors.New("userID is required for user-specific AI clients")
	}

	log.Printf("📋 NewAIClientWithUserID: Fetching default LLM profile for user %s", userID)
	profile, err := models.GetDefaultLLMProfile(context.Background(), userID)
	if err != nil {
		log.Printf("❌ NewAIClientWithUserID: Failed to get LLM profile for user %s: %v", userID, err)
		return nil, fmt.Errorf("failed to get LLM profile for user %s: %w", userID, err)
	}
	if profile == nil {
		log.Printf("❌ NewAIClientWithUserID: No default LLM profile found for user %s", userID)
		return nil, fmt.Errorf("no default LLM profile found for user %s", userID)
	}

	log.Printf("🔍 NewAIClientWithUserID: Retrieved profile '%s' (ID: %s) for user %s", profile.Name, profile.ID, userID)
	log.Printf("🔍 NewAIClientWithUserID: Profile validation - ServerURL: %s, APIKey present: %v", profile.ServerURL, profile.APIKey != "")

	if profile.ServerURL == "" {
		// Enforce default LangGraph endpoint if not explicitly set
		profile.ServerURL = "http://localhost:8000/api/v1/langgraph/run"
		log.Printf("⚙️ NewAIClientWithUserID: Applied default LangGraph endpoint for user %s -> %s", userID, profile.ServerURL)
	}

	if profile.APIKey == "" {
		log.Printf("❌ NewAIClientWithUserID: Missing API key in LLM profile for user %s", userID)
		return nil, fmt.Errorf("missing API key in LLM profile for user %s", userID)
	}

	// Assign validated/decrypted credentials
	client.ServerURL = normalizeServerURL(profile.ServerURL) // Normalize URL here
	client.APIKey = profile.APIKey
	client.Model = profile.Model
	client.ProfileID = profile.ID

	log.Printf("✅ NewAIClientWithUserID: Successfully created LangGraph AI client for user %s | endpoint=%s | model=%s",
		userID, client.ServerURL, client.Model)
	return client, nil
}

// UseProfile updates the client to use a specific LLM profile
func (c *AIClient) UseProfile(ctx context.Context, profileID string) error {
	if c.UserID == "" {
		return errors.New("client has no associated user ID")
	}

	profile, err := models.GetLLMProfile(ctx, profileID)
	if err != nil {
		return fmt.Errorf("failed to get LLM profile: %w", err)
	}

	// Verify ownership
	if profile.UserID != c.UserID {
		return errors.New("profile does not belong to the current user")
	}

	// Update client configuration
	c.ServerURL = profile.ServerURL
	c.APIKey = profile.APIKey
	c.Model = profile.Model
	c.ProfileID = profile.ID

	log.Printf("✅ Switched to LangChain LLM profile '%s'", profile.Name)
	return nil
}

// UseDefaultProfile updates the client to use the default LLM profile for the current user
func (c *AIClient) UseDefaultProfile(ctx context.Context) error {
	if c.UserID == "" {
		return errors.New("client has no associated user ID")
	}

	profile, err := models.GetDefaultLLMProfile(ctx, c.UserID)
	if err != nil {
		return fmt.Errorf("failed to get default LLM profile: %w", err)
	}

	if profile == nil {
		return errors.New("no default LLM profile found")
	}

	// Update client configuration
	c.ServerURL = profile.ServerURL
	c.APIKey = profile.APIKey
	c.Model = profile.Model
	c.ProfileID = profile.ID

	log.Printf("✅ Using default LangChain profile '%s'", profile.Name)
	return nil
}

// AnalyzeContentLegacy is the legacy method signature for backward compatibility
func (c *AIClient) AnalyzeContentLegacy(ctx context.Context, content, source string) (*AIAnalysisResponse, error) {
	// Use the new interface method and convert response
	resp, err := c.AnalyzeContent(ctx, &AnalysisRequest{
		Content: content,
		Source:  source,
	})
	if err != nil {
		return nil, err
	}

	return &AIAnalysisResponse{
		Tags:        resp.Tags,
		Summary:     resp.Summary,
		Topics:      resp.Topics,
		Keywords:    resp.Keywords,
		ProcessedAt: resp.ProcessedAt,
	}, nil
}

// AnalyzeContent implements the LLMClient interface using direct LLM calls
func (c *AIClient) AnalyzeContent(ctx context.Context, req *AnalysisRequest) (*AnalysisResponse, error) {
	log.Printf("🚀 Using direct LLM analysis (model=%s, user=%s)", c.Model, c.UserID)

	if c.APIKey == "" {
		return nil, fmt.Errorf("missing API key")
	}

	// Create a simple prompt for content analysis
	prompt := fmt.Sprintf("Analyze the following content and provide a summary and key topics:\n\nContent: %s\n\nPlease provide a concise summary and identify 3-5 key topics or tags.", req.Content)

	// Make direct HTTP request to the LLM API
	payload := map[string]interface{}{
		"model": c.Model,
		"messages": []map[string]string{
			{"role": "user", "content": prompt},
		},
		"max_tokens": 1000,
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to serialize LLM payload: %w", err)
	}

	// Construct the full URL for the chat completions endpoint
	fullURL := fmt.Sprintf("%s/v1/chat/completions", strings.TrimSuffix(c.ServerURL, "/"))
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, fullURL, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create LLM request: %w", err)
	}

	httpReq.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.APIKey))
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.HTTPClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed LLM request: %w", err)
	}
	defer resp.Body.Close()

	var body struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
		Error struct {
			Message string `json:"message"`
		} `json:"error"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return nil, fmt.Errorf("invalid LLM response format: %w", err)
	}

	if resp.StatusCode != http.StatusOK || body.Error.Message != "" {
		return nil, fmt.Errorf("LLM request failed [%d]: %s", resp.StatusCode, body.Error.Message)
	}

	if len(body.Choices) == 0 {
		return nil, fmt.Errorf("no response from LLM")
	}

	result := body.Choices[0].Message.Content

	// Extract tags from the response (simple keyword extraction)
	tags := extractTagsFromResponseAIClient(result)

	// Create response with structured data
	response := &AnalysisResponse{
		Tags:        tags,
		Summary:     result,
		Topics:      tags, // Use same tags for topics for now
		Keywords:    tags, // Use same tags for keywords for now
		Confidence:  0.8,
		ProcessedAt: time.Now().Format(time.RFC3339),
		ProviderMeta: map[string]interface{}{
			"source":    "direct-llm",
			"model":     c.Model,
			"provider":  "direct",
			"timestamp": time.Now(),
		},
	}

	log.Printf("✅ Direct LLM analysis successful for user=%s | %d tags", c.UserID, len(response.Tags))
	return response, nil
}

// GetProviderInfo returns provider information
func (c *AIClient) GetProviderInfo() *ProviderInfo {
	return &ProviderInfo{
		Type:       "direct",
		Provider:   "direct",
		Model:      c.Model,
		Version:    "1.0",
		LastUsedAt: time.Now(),
	}
}

// Close releases any resources held by the client
func (c *AIClient) Close() error {
	// No persistent connections to close
	return nil
}

// extractTagsFromResponseAIClient performs simple keyword extraction from LLM response
func extractTagsFromResponseAIClient(response string) []string {
	// Simple implementation - split by common separators and take meaningful words
	words := strings.Fields(response)
	var tags []string

	for _, word := range words {
		// Filter out common words and keep meaningful ones
		cleanWord := strings.Trim(strings.ToLower(word), ".,!?;:\"'()[]{}")
		if len(cleanWord) > 3 && !isCommonWordAIClient(cleanWord) {
			tags = append(tags, cleanWord)
			if len(tags) >= 5 { // Limit to 5 tags
				break
			}
		}
	}

	return tags
}

// isCommonWordAIClient checks if a word is too common to be a meaningful tag
func isCommonWordAIClient(word string) bool {
	commonWords := map[string]bool{
		"the": true, "and": true, "for": true, "with": true, "this": true,
		"that": true, "from": true, "have": true, "been": true, "they": true,
		"their": true, "what": true, "when": true, "where": true, "why": true,
		"how": true, "which": true, "will": true, "would": true, "could": true,
		"should": true, "about": true, "into": true, "through": true, "during": true,
		"before": true, "after": true, "above": true, "below": true, "between": true,
		"among": true, "while": true, "until": true, "since": true, "because": true,
		"although": true, "though": true, "unless": true, "whether": true,
	}

	return commonWords[word]
}

// MockAnalyzeContent provides a mock implementation for testing or when AI service is unavailable
func (c *AIClient) MockAnalyzeContent(ctx context.Context, content, source string) (*AIAnalysisResponse, error) {
	log.Printf("Using mock AI analysis for content from source: %s", source)

	// Generate some basic tags based on content length
	tags := []string{"auto-generated", "mock-tag"}

	// Add source-specific tag
	if source != "" {
		tags = append(tags, source)
	}

	// Generate a simple summary
	summary := ""
	if len(content) > 100 {
		summary = content[:97] + "..."
	} else {
		summary = content
	}

	return &AIAnalysisResponse{
		Tags:        tags,
		Summary:     summary,
		Topics:      []string{"mock-topic"},
		Keywords:    []string{"mock", "keywords"},
		ProcessedAt: time.Now().Format(time.RFC3339),
	}, nil
}

// detectAIPath intelligently determines the correct API path based on BaseURL
func detectAIPath(baseURL string) string {
	lower := strings.ToLower(baseURL)
	switch {
	case strings.Contains(lower, "langchain"):
		return "api/v1/analyze"
	case strings.Contains(lower, "fastapi") || strings.HasSuffix(lower, "/api"):
		return "api/v1/analyze"
	default:
		return "v1/analyze"
	}
}

// normalizeServerURL normalizes server URLs to prevent endpoint duplication
// Removes common API endpoint suffixes to ensure base URLs are stored
func normalizeServerURL(serverURL string) string {
	if serverURL == "" {
		return ""
	}

	// Trim whitespace and trailing slashes
	normalized := strings.TrimSpace(serverURL)
	normalized = strings.TrimSuffix(normalized, "/")

	// Parse the URL to handle different components
	u, err := url.Parse(normalized)
	if err != nil {
		log.Printf("Warning: Failed to parse URL %s for normalization: %v", serverURL, err)
		return serverURL // Return original if parsing fails
	}

	// Define common API endpoint paths to remove
	// These are paths that LangChain-Go might append, so we want the base
	endpointsToRemove := []string{
		"/v1/chat/completions",
		"/v1/models",
		"/v1/messages",
		"/api/chat",             // For Ollama
		"/api/tags",             // For Ollama
		"/api/v1/langgraph/run", // Specific LangGraph endpoint
	}

	// Check if the path component ends with any of the known endpoints
	for _, endpoint := range endpointsToRemove {
		if strings.HasSuffix(u.Path, endpoint) {
			u.Path = strings.TrimSuffix(u.Path, endpoint)
			// Ensure path starts with a slash if it's not empty
			if u.Path != "" && !strings.HasPrefix(u.Path, "/") {
				u.Path = "/" + u.Path
			}
			break // Only remove one endpoint suffix
		}
	}

	// Reconstruct the URL, ensuring no double slashes in the path
	finalURL := u.Scheme + "://" + u.Host + strings.TrimSuffix(u.Path, "/")
	return finalURL
}
