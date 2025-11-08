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

	"strings"
	"zurabase/models"
)

// AIClient provides methods to interact with LangChain-based AI services only
type AIClient struct {
	ServiceName string
	Model       string
	APIKey      string
	HTTPClient  *http.Client
	UserID      string
	ProfileID   string
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
	httpClient := &http.Client{Timeout: 30 * time.Second}
	client := &AIClient{HTTPClient: httpClient, UserID: userID}

	if userID == "" {
		return nil, errors.New("userID is required for user-specific AI clients")
	}

	profile, err := models.GetDefaultLLMProfile(context.Background(), userID)
	if err != nil {
		return nil, fmt.Errorf("failed to get LLM profile for user %s: %w", userID, err)
	}
	if profile == nil {
		return nil, fmt.Errorf("no default LLM profile found for user %s", userID)
	}

	if profile.ServerURL == "" || profile.APIKey == "" {
		return nil, fmt.Errorf("invalid LLM profile configuration for user %s", userID)
	}

	client.ServiceName = "LangChain"
	client.APIKey = profile.APIKey
	client.Model = profile.Model
	client.ProfileID = profile.ID

	log.Printf("✅ Using LangChain-based LLM profile '%s' for user %s", profile.Name, userID)
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
	c.ServiceName = "LangChain"
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
	c.ServiceName = "LangChain"
	c.APIKey = profile.APIKey
	c.Model = profile.Model
	c.ProfileID = profile.ID

	log.Printf("✅ Using default LangChain profile '%s'", profile.Name)
	return nil
}

// AnalyzeContent now exclusively uses LangChain endpoints
func (c *AIClient) AnalyzeContent(ctx context.Context, content, source string) (*AIAnalysisResponse, error) {
	log.Printf("🚀 Using LangGraph workflow for AI analysis (model=%s, user=%s)", c.Model, c.UserID)

	if c.APIKey == "" {
		return nil, fmt.Errorf("missing API key")
	}

	payload := map[string]interface{}{
		"workflow": "content_analysis_graph",
		"inputs": map[string]interface{}{
			"content":  content,
			"source":   source,
			"user_id":  c.UserID,
			"model":    c.Model,
			"profile":  c.ProfileID,
			"metadata": map[string]interface{}{"service": "LangGraph"},
		},
		"options": map[string]interface{}{
			"trace":          true,
			"return_schema":  true,
			"timeout_seconds": 60,
		},
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("failed to serialize LangGraph workflow payload: %w", err)
	}

	url := "http://localhost:8000/api/v1/langgraph/run"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewBuffer(jsonData))
	if err != nil {
		return nil, fmt.Errorf("failed to create LangGraph request: %w", err)
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.APIKey))
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed LangGraph request: %w", err)
	}
	defer resp.Body.Close()

	var body struct {
		Output struct {
			Tags       []string `json:"tags"`
			Summary    string   `json:"summary"`
			Topics     []string `json:"topics"`
			Keywords   []string `json:"keywords"`
			Confidence float64  `json:"confidence"`
		} `json:"output"`
		Error string `json:"error,omitempty"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		return nil, fmt.Errorf("invalid LangGraph response format: %w", err)
	}

	if resp.StatusCode != http.StatusOK || body.Error != "" {
		return nil, fmt.Errorf("LangGraph workflow failed [%d]: %s", resp.StatusCode, body.Error)
	}

	response := &AIAnalysisResponse{
		Tags:        body.Output.Tags,
		Summary:     body.Output.Summary,
		Topics:      body.Output.Topics,
		Keywords:    body.Output.Keywords,
		ProcessedAt: time.Now().Format(time.RFC3339),
	}

	log.Printf("✅ LangGraph AI analysis successful for user=%s | %d tags", c.UserID, len(response.Tags))
	return response, nil
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
