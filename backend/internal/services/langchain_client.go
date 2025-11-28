package services

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"zurabase/internal/models"

	"github.com/tmc/langchaingo/llms"
	"github.com/tmc/langchaingo/llms/openai"
)

// LangChainClient implements LLMClient using LangChain-Go library directly
type LangChainClient struct {
	model    string
	provider string
	client   llms.Model
}

// NewLangChainClient produces a new instance of LangChainClient using LLM profile
func NewLangChainClient(profile *models.LLMProfile) (*LangChainClient, error) {
	if profile == nil {
		return nil, fmt.Errorf("LLM profile is required")
	}

	if profile.ServerURL == "" || profile.APIKey == "" {
		return nil, fmt.Errorf("invalid LLM profile configuration: ServerURL and APIKey are required")
	}

	if profile.Model == "" {
		return nil, fmt.Errorf("invalid LLM profile configuration: Model is required")
	}

	// Configure the LLM client based on the profile
	var client llms.Model
	var err error

	// Determine provider from ServerURL or use default
	provider := "openai-compatible"
	if strings.Contains(strings.ToLower(profile.ServerURL), "openai") {
		provider = "openai"
	} else if strings.Contains(strings.ToLower(profile.ServerURL), "anthropic") {
		provider = "anthropic"
	}

	// LangChain-Go expects base URL with /v1 suffix for OpenAI-compatible APIs
	// It will append the specific endpoint (e.g., /chat/completions) automatically
	baseURL := strings.TrimSuffix(profile.ServerURL, "/") + "/v1"

	log.Printf("🔧 Initializing LangChain client: BaseURL=%s, Model=%s, Provider=%s", baseURL, profile.Model, provider)

	// For now, we'll use OpenAI-compatible API for all providers
	// since LangChain-Go supports OpenAI-compatible endpoints
	client, err = openai.New(
		openai.WithBaseURL(baseURL),
		openai.WithToken(profile.APIKey),
		openai.WithModel(profile.Model),
	)

	if err != nil {
		return nil, fmt.Errorf("failed to initialize LangChain-Go LLM: %w", err)
	}

	log.Printf("✅ LangChain client initialized successfully for model %s", profile.Model)

	return &LangChainClient{
		model:    profile.Model,
		provider: provider,
		client:   client,
	}, nil
}

// AnalyzeContent runs a simple summarization or tag extraction pipeline
func (lc *LangChainClient) AnalyzeContent(ctx context.Context, req *AnalysisRequest) (*AnalysisResponse, error) {
	// Create a simple prompt for content analysis
	prompt := fmt.Sprintf("Analyze the following content and provide a summary and key topics:\n\nContent: %s\n\nPlease provide a concise summary and identify 3-5 key topics or tags.", req.Content)

	// Use the LLM directly for now (simplified approach)
	result, err := lc.client.Call(ctx, prompt)
	if err != nil {
		return nil, fmt.Errorf("LangChain-Go LLM call failed: %w", err)
	}

	// Extract tags from the response (simple keyword extraction)
	tags := extractTagsFromResponse(result)

	// Create response with structured data
	return &AnalysisResponse{
		Tags:        tags,
		Summary:     result,
		Topics:      tags, // Use same tags for topics for now
		Keywords:    tags, // Use same tags for keywords for now
		Confidence:  0.8,
		ProcessedAt: time.Now().Format(time.RFC3339),
		ProviderMeta: map[string]interface{}{
			"source":    "langchain-go",
			"model":     lc.model,
			"provider":  lc.provider,
			"timestamp": time.Now(),
		},
	}, nil
}

// extractTagsFromResponse performs simple keyword extraction from LLM response
func extractTagsFromResponse(response string) []string {
	// Simple implementation - split by common separators and take meaningful words
	words := strings.Fields(response)
	var tags []string

	for _, word := range words {
		// Filter out common words and keep meaningful ones
		cleanWord := strings.Trim(strings.ToLower(word), ".,!?;:\"'()[]{}")
		if len(cleanWord) > 3 && !isCommonWord(cleanWord) {
			tags = append(tags, cleanWord)
			if len(tags) >= 5 { // Limit to 5 tags
				break
			}
		}
	}

	return tags
}

// isCommonWord checks if a word is too common to be a meaningful tag
func isCommonWord(word string) bool {
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

func (lc *LangChainClient) GetProviderInfo() *ProviderInfo {
	return &ProviderInfo{
		Type:       "langchain",
		Provider:   lc.provider,
		Model:      lc.model,
		Version:    "go",
		LastUsedAt: time.Now(),
	}
}

func (lc *LangChainClient) Close() error {
	// No persistent connections to close in current LangChain-Go
	return nil
}
