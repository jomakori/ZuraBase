package services

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"
)

// AIClient provides methods to interact with an OpenAPI-compatible AI service
type AIClient struct {
	BaseURL    string
	APIKey     string
	HTTPClient *http.Client
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
func NewAIClient() (*AIClient, error) {
	baseURL := os.Getenv("AI_SERVICE_URL")
	apiKey := os.Getenv("AI_SERVICE_API_KEY")

	if baseURL == "" {
		return nil, errors.New("AI_SERVICE_URL environment variable is not set")
	}

	if apiKey == "" {
		return nil, errors.New("AI_SERVICE_API_KEY environment variable is not set")
	}

	return &AIClient{
		BaseURL: baseURL,
		APIKey:  apiKey,
		HTTPClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}, nil
}

// AnalyzeContent sends content to the AI service for analysis
func (c *AIClient) AnalyzeContent(ctx context.Context, content, source string) (*AIAnalysisResponse, error) {
	log.Printf("Analyzing content from source: %s", source)

	reqBody := AIAnalysisRequest{
		Content: content,
		Source:  source,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(
		ctx,
		"POST",
		fmt.Sprintf("%s/v1/analyze", c.BaseURL),
		bytes.NewBuffer(jsonData),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", c.APIKey))

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("AI service returned non-OK status: %d", resp.StatusCode)
	}

	var result AIAnalysisResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("failed to decode response: %w", err)
	}

	if result.Error != "" {
		return nil, fmt.Errorf("AI service returned error: %s", result.Error)
	}

	log.Printf("Content analyzed successfully. Generated %d tags and summary", len(result.Tags))
	return &result, nil
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
