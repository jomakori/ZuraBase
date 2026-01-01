package services

import (
	"context"
	"time"
)

// LLMClient defines a unified interface for all LLM interactions (LangChain-Go, LangGraph, Legacy)
type LLMClient interface {
	AnalyzeContent(ctx context.Context, req *AnalysisRequest) (*AnalysisResponse, error)
	GetProviderInfo() *ProviderInfo
	Close() error
}

// AnalysisRequest encapsulates request metadata for LLM interactions
type AnalysisRequest struct {
	Content string
	Source  string
	Options *AnalysisOptions
}

// AnalysisResponse represents normalized content analysis results
type AnalysisResponse struct {
	Tags         []string
	Summary      string
	Topics       []string
	Keywords     []string
	Confidence   float64
	ProcessedAt  string
	ProviderMeta map[string]interface{}
}

// AnalysisOptions provides configurable LLM parameters
type AnalysisOptions struct {
	Temperature float64
	MaxTokens   int
}

// ProviderInfo describes provider-level metadata
type ProviderInfo struct {
	Type       string
	Provider   string
	Model      string
	Version    string
	LastUsedAt time.Time
}
