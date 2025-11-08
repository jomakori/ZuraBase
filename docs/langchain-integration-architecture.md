
# ZuraBase LangChain Integration Architecture Specification

**Version:** 1.0  
**Date:** 2025-11-01  
**Status:** Design Phase

---

## Executive Summary

This document specifies the architectural design for integrating LangChain and LangGraph into ZuraBase's backend to manage model interaction workflows.
The architecture now adopts LangGraph-style workflow orchestration principles demonstrated by FreeCodeCamp’s guide “How to Use LangChain and LangGraph — A Beginner’s Guide to AI Workflows”.

The migration expands the legacy LangChain HTTP implementation with graph-based pipelines.
Each AI process (summarization, tagging, context linkage) runs as a discrete node in a **LangGraph DAG**, interconnected via well-defined data edges.

---

## LangGraph Workflow Integration

**Workflow Composition**

Each ZuraBase AI operation is now represented as a graph execution request:

```json
{
  "workflow": "content_analysis_graph",
  "inputs": {
    "content": "User-entered text",
    "source": "manual-entry",
    "metadata": {
      "user_id": "abc123",
      "profile_id": "p1"
    }
  },
  "options": {
    "trace": true,
    "return_schema": true
  }
}
```

**Processing Stages inside LangGraph**

```
[PromptBuilder] → [ContextInjector] → [ModelExecutor] → [OutputParser] → [Normalizer]
```

Each node is isolated and can fail independently, improving resilience. The nodes communicate through typed payload schemas matching the `AnalysisRequest` and `AnalysisResponse` types in Go.

### Updated Endpoint Specification

The Go backend now targets the unified LangGraph service endpoint:

```
POST http://localhost:8000/api/v1/langgraph/run
```

Requests mirror the example JSON and include workflow metadata. Responses follow a nested `output` object format for predictable JSON decoding.

### Migration Benefits

- Modular and composable AI logic
- Better debugging with trace identifiers per workflow
- Consistent JSON schema for structured output
- Hybrid-mode compatibility for legacy `LangChainClient`
- Smooth transition path to LCEL (LangChain Expression Language)

---

## Implementation Notes

- Refactored `AIClient.AnalyzeContent()` to delegate to `/api/v1/langgraph/run`
- Added `workflow`, `inputs`, and `options` keys supporting metadata context passing
- Response parsing updated to accept nested `"output"` format
- Error handling unified into structured `LangGraphResponse.Error` field
- Enables per-user LLM profile resolution to determine graph routing behavior

---

## Developer Operations

During development, launch a local LangGraph-compatible agent via Docker:

```bash
docker run -d -p 8000:8000 langgraph-service:latest
```

Use environment mode:

```bash
export LLM_CLIENT_MODE=langchain
```

or for hybrid use:

```bash
export LLM_CLIENT_MODE=hybrid
```

---

The overall goal is a **fully observable, modular, and provider-agnostic AI workflow orchestration layer** for ZuraBase, bridging LangChain and LangGraph.

**Key Objectives:**
- Unified LLM interaction layer using LangChain
- Structured prompt management with versioning
- Enhanced context and memory support
- Deterministic output parsing
- Improved observability and error handling
- Seamless migration path from existing AIClient

---

## Table of Contents

- [ZuraBase LangChain Integration Architecture Specification](#zurabase-langchain-integration-architecture-specification)
  - [Executive Summary](#executive-summary)
  - [LangGraph Workflow Integration](#langgraph-workflow-integration)
    - [Updated Endpoint Specification](#updated-endpoint-specification)
    - [Migration Benefits](#migration-benefits)
  - [Implementation Notes](#implementation-notes)
  - [Developer Operations](#developer-operations)
  - [Table of Contents](#table-of-contents)
  - [1. Current Architecture Analysis](#1-current-architecture-analysis)
    - [1.1 Existing Components](#11-existing-components)
    - [1.2 Current Data Flow](#12-current-data-flow)
    - [1.3 Pain Points](#13-pain-points)
  - [2. Core Architectural Adaptation](#2-core-architectural-adaptation)
    - [2.1 LLMClient Interface](#21-llmclient-interface)
    - [2.2 LangChainClient Implementation](#22-langchainclient-implementation)
    - [2.3 Legacy AIClient Adapter](#23-legacy-aiclient-adapter)
    - [2.4 Client Factory](#24-client-factory)
  - [3. LangChain Integration Design](#3-langchain-integration-design)
    - [3.1 Chain Architecture Overview](#31-chain-architecture-overview)
    - [3.2 LangChain Go Integration Approach](#32-langchain-go-integration-approach)
    - [3.3 LangChain Service API Specification](#33-langchain-service-api-specification)
    - [3.4 Prompts Package Structure](#34-prompts-package-structure)
    - [3.5 Prompt Templates](#35-prompt-templates)
    - [3.6 Chains Package](#36-chains-package)

---

## 1. Current Architecture Analysis

### 1.1 Existing Components

**AIClient (`backend/internal/services/ai_client.go`)**
- Direct HTTP client to OpenAI-compatible APIs
- Simple request/response pattern
- User-specific LLM profile support
- Basic retry logic with exponential backoff
- Mock implementation fallback

**TagService (`backend/internal/services/tag_service.go`)**
- Wraps AIClient for tag extraction
- Tag normalization and deduplication
- Related strand discovery
- Context-aware analysis

**LLMProfile (`backend/models/llm_profile.go`)**
- User-specific LLM configurations
- Encrypted API key storage (AES-256-GCM)
- Default profile management
- Server URL, model, and API key per profile

**StrandsHandler (`backend/api/strands/handler.go`)**
- Async background enrichment
- Auto-sync for unsynced strands
- User-specific AI client instantiation
- Panic recovery and error handling

### 1.2 Current Data Flow

```
User Request → StrandsHandler → AIClient → External LLM API
                     ↓
              TagService (normalization)
                     ↓
              Strand Model (save to MongoDB)
                     ↓
              Background enrichment (goroutine)
```

### 1.3 Pain Points

1. **Prompt Management**: Hardcoded prompts in HTTP request bodies
2. **Output Parsing**: Manual JSON parsing with error-prone validation
3. **Context Handling**: Limited conversation memory
4. **Observability**: Basic logging, no structured telemetry
5. **Testing**: Difficult to mock and test complex chains
6. **Extensibility**: Adding new AI operations requires significant boilerplate

---

## 2. Core Architectural Adaptation

### 2.1 LLMClient Interface

Create a unified interface that abstracts both legacy and LangChain implementations:

```go
// backend/internal/services/llm_client.go

package services

import (
    "context"
)

// LLMClient defines the interface for all LLM interactions
type LLMClient interface {
    // AnalyzeContent performs content analysis and returns structured results
    AnalyzeContent(ctx context.Context, req *AnalysisRequest) (*AnalysisResponse, error)
    
    // ExtractTags extracts tags from content
    ExtractTags(ctx context.Context, content string, options *TagExtractionOptions) ([]string, error)
    
    // GenerateSummary creates a summary of the content
    GenerateSummary(ctx context.Context, content string, maxLength int) (string, error)
    
    // FindRelatedContent discovers related content based on semantic similarity
    FindRelatedContent(ctx context.Context, content string, candidates []string) ([]RelatedItem, error)
    
    // GetProviderInfo returns information about the underlying provider
    GetProviderInfo() *ProviderInfo
    
    // Close releases any resources held by the client
    Close() error
}

// AnalysisRequest encapsulates all parameters for content analysis
type AnalysisRequest struct {
    Content         string
    Source          string
    Context         []ContextItem
    UserTags        []string
    Options         *AnalysisOptions
}

// AnalysisResponse contains structured analysis results
type AnalysisResponse struct {
    Tags            []string
    Summary         string
    RelatedIDs      []string
    Topics          []string
    Keywords        []string
    Sentiment       string
    Confidence      float64
    ProcessedAt     string
    ProviderMetadata map[string]interface{}
}

// TagExtractionOptions configures tag extraction behavior
type TagExtractionOptions struct {
    MaxTags         int
    MinConfidence   float64
    IncludeContext  bool
    ContextItems    []ContextItem
}

// ContextItem represents a piece of context for analysis
type ContextItem struct {
    Content     string
    Tags        []string
    Summary     string
    Relevance   float64
}

// RelatedItem represents a related content item
type RelatedItem struct {
    ID              string
    Content         string
    SimilarityScore float64
    Reason          string
}

// ProviderInfo contains metadata about the LLM provider
type ProviderInfo struct {
    Type            string // "legacy", "langchain"
    Provider        string // "openai", "anthropic", etc.
    Model           string
    SupportsStreaming bool
    SupportsMemory  bool
}

// AnalysisOptions configures analysis behavior
type AnalysisOptions struct {
    Temperature     float64
    MaxTokens       int
    IncludeTopics   bool
    IncludeKeywords bool
    IncludeSentiment bool
}
```

### 2.2 LangChainClient Implementation

```go
// backend/internal/services/langchain_client.go

package services

import (
    "context"
    "fmt"
    
    "zurabase/internal/langchain/chains"
    "zurabase/internal/langchain/prompts"
    "zurabase/models"
)

// LangChainClient implements LLMClient using LangChain
type LangChainClient struct {
    profile         *models.LLMProfile
    chainManager    *chains.ChainManager
    promptManager   *prompts.PromptManager
    memoryStore     *chains.MemoryStore
    config          *LangChainConfig
}

// LangChainConfig holds LangChain-specific configuration
type LangChainConfig struct {
    ServiceURL      string
    Timeout         int
    MaxRetries      int
    EnableMemory    bool
    EnableTelemetry bool
    CacheEnabled    bool
}

// NewLangChainClient creates a new LangChain-based client
func NewLangChainClient(profile *models.LLMProfile, config *LangChainConfig) (*LangChainClient, error) {
    // Initialize chain manager
    chainManager, err := chains.NewChainManager(profile, config)
    if err != nil {
        return nil, fmt.Errorf("failed to create chain manager: %w", err)
    }
    
    // Initialize prompt manager
    promptManager, err := prompts.NewPromptManager()
    if err != nil {
        return nil, fmt.Errorf("failed to create prompt manager: %w", err)
    }
    
    // Initialize memory store if enabled
    var memoryStore *chains.MemoryStore
    if config.EnableMemory {
        memoryStore = chains.NewMemoryStore()
    }
    
    return &LangChainClient{
        profile:       profile,
        chainManager:  chainManager,
        promptManager: promptManager,
        memoryStore:   memoryStore,
        config:        config,
    }, nil
}

// AnalyzeContent implements the LLMClient interface
func (c *LangChainClient) AnalyzeContent(ctx context.Context, req *AnalysisRequest) (*AnalysisResponse, error) {
    // Build the analysis chain
    chain := c.chainManager.GetAnalysisChain()
    
    // Prepare input with context
    input := c.prepareAnalysisInput(req)
    
    // Execute chain
    result, err := chain.Execute(ctx, input)
    if err != nil {
        return nil, fmt.Errorf("chain execution failed: %w", err)
    }
    
    // Parse structured output
    response, err := c.parseAnalysisResult(result)
    if err != nil {
        return nil, fmt.Errorf("failed to parse result: %w", err)
    }
    
    return response, nil
}

// ExtractTags implements tag extraction using LangChain
func (c *LangChainClient) ExtractTags(ctx context.Context, content string, options *TagExtractionOptions) ([]string, error) {
    chain := c.chainManager.GetTagExtractionChain()
    
    input := &chains.ChainInput{
        Content: content,
        Options: map[string]interface{}{
            "max_tags":       options.MaxTags,
            "min_confidence": options.MinConfidence,
        },
    }
    
    if options.IncludeContext {
        input.Context = options.ContextItems
    }
    
    result, err := chain.Execute(ctx, input)
    if err != nil {
        return nil, err
    }
    
    return result.Tags, nil
}

// GenerateSummary implements summarization using LangChain
func (c *LangChainClient) GenerateSummary(ctx context.Context, content string, maxLength int) (string, error) {
    chain := c.chainManager.GetSummarizationChain()
    
    input := &chains.ChainInput{
        Content: content,
        Options: map[string]interface{}{
            "max_length": maxLength,
        },
    }
    
    result, err := chain.Execute(ctx, input)
    if err != nil {
        return "", err
    }
    
    return result.Summary, nil
}

// FindRelatedContent implements semantic search using LangChain
func (c *LangChainClient) FindRelatedContent(ctx context.Context, content string, candidates []string) ([]RelatedItem, error) {
    chain := c.chainManager.GetRelatedDiscoveryChain()
    
    input := &chains.ChainInput{
        Content: content,
        Options: map[string]interface{}{
            "candidates": candidates,
        },
    }
    
    result, err := chain.Execute(ctx, input)
    if err != nil {
        return nil, err
    }
    
    // Convert chain output to RelatedItem format
    items := make([]RelatedItem, 0, len(result.Metadata["related"].([]interface{})))
    for _, item := range result.Metadata["related"].([]interface{}) {
        itemMap := item.(map[string]interface{})
        items = append(items, RelatedItem{
            ID:              itemMap["id"].(string),
            Content:         itemMap["content"].(string),
            SimilarityScore: itemMap["similarity_score"].(float64),
            Reason:          itemMap["reason"].(string),
        })
    }
    
    return items, nil
}

// GetProviderInfo returns provider information
func (c *LangChainClient) GetProviderInfo() *ProviderInfo {
    return &ProviderInfo{
        Type:              "langchain",
        Provider:          c.profile.Provider,
        Model:             c.profile.Model,
        SupportsStreaming: true,
        SupportsMemory:    c.config.EnableMemory,
    }
}

// Close releases resources
func (c *LangChainClient) Close() error {
    if c.memoryStore != nil {
        c.memoryStore.Clear()
    }
    return nil
}

// Helper methods
func (c *LangChainClient) prepareAnalysisInput(req *AnalysisRequest) *chains.ChainInput {
    return &chains.ChainInput{
        Content:  req.Content,
        Source:   req.Source,
        Context:  req.Context,
        UserTags: req.UserTags,
        Options: map[string]interface{}{
            "temperature":       req.Options.Temperature,
            "max_tokens":        req.Options.MaxTokens,
            "include_topics":    req.Options.IncludeTopics,
            "include_keywords":  req.Options.IncludeKeywords,
            "include_sentiment": req.Options.IncludeSentiment,
        },
    }
}

func (c *LangChainClient) parseAnalysisResult(result *chains.ChainOutput) (*AnalysisResponse, error) {
    return &AnalysisResponse{
        Tags:             result.Tags,
        Summary:          result.Summary,
        Topics:           result.Topics,
        Keywords:         result.Keywords,
        Sentiment:        result.Sentiment,
        Confidence:       result.Confidence,
        ProcessedAt:      time.Now().Format(time.RFC3339),
        ProviderMetadata: result.Metadata,
    }, nil
}
```

### 2.3 Legacy AIClient Adapter

Wrap existing AIClient to implement LLMClient interface:

```go
// backend/internal/services/legacy_client_adapter.go

package services

import (
    "context"
    "time"
)

// LegacyClientAdapter wraps AIClient to implement LLMClient interface
type LegacyClientAdapter struct {
    aiClient *AIClient
}

// NewLegacyClientAdapter creates an adapter for the legacy AIClient
func NewLegacyClientAdapter(aiClient *AIClient) *LegacyClientAdapter {
    return &LegacyClientAdapter{
        aiClient: aiClient,
    }
}

// AnalyzeContent adapts the legacy AnalyzeContent method
func (a *LegacyClientAdapter) AnalyzeContent(ctx context.Context, req *AnalysisRequest) (*AnalysisResponse, error) {
    // Convert new request format to legacy format
    legacyResp, err := a.aiClient.AnalyzeContent(ctx, req.Content, req.Source)
    if err != nil {
        return nil, err
    }
    
    // Convert legacy response to new format
    return &AnalysisResponse{
        Tags:        legacyResp.Tags,
        Summary:     legacyResp.Summary,
        RelatedIDs:  legacyResp.RelatedIDs,
        Topics:      legacyResp.Topics,
        Keywords:    legacyResp.Keywords,
        ProcessedAt: legacyResp.ProcessedAt,
    }, nil
}

// ExtractTags adapts tag extraction
func (a *LegacyClientAdapter) ExtractTags(ctx context.Context, content string, options *TagExtractionOptions) ([]string, error) {
    // Use legacy AnalyzeContent and extract tags
    resp, err := a.aiClient.AnalyzeContent(ctx, content, "")
    if err != nil {
        return nil, err
    }
    return resp.Tags, nil
}

// GenerateSummary adapts summarization
func (a *LegacyClientAdapter) GenerateSummary(ctx context.Context, content string, maxLength int) (string, error) {
    resp, err := a.aiClient.AnalyzeContent(ctx, content, "")
    if err != nil {
        return "", err
    }
    
    // Truncate if needed
    if len(resp.Summary) > maxLength {
        return resp.Summary[:maxLength-3] + "...", nil
    }
    return resp.Summary, nil
}

// FindRelatedContent is not supported in legacy mode
func (a *LegacyClientAdapter) FindRelatedContent(ctx context.Context, content string, candidates []string) ([]RelatedItem, error) {
    // Legacy client doesn't support this - return empty
    return []RelatedItem{}, nil
}

// GetProviderInfo returns legacy provider info
func (a *LegacyClientAdapter) GetProviderInfo() *ProviderInfo {
    return &ProviderInfo{
        Type:              "legacy",
        Provider:          "openai-compatible",
        Model:             "unknown",
        SupportsStreaming: false,
        SupportsMemory:    false,
    }
}

// Close is a no-op for legacy client
func (a *LegacyClientAdapter) Close() error {
    return nil
}
```

### 2.4 Client Factory

```go
// backend/internal/services/llm_client_factory.go

package services

import (
    "context"
    "fmt"
    "os"
    
    "zurabase/models"
)

// ClientMode determines which client implementation to use
type ClientMode string

const (
    ModeLegacy    ClientMode = "legacy"
    ModeLangChain ClientMode = "langchain"
    ModeHybrid    ClientMode = "hybrid"
)

// LLMClientFactory creates appropriate LLMClient instances
type LLMClientFactory struct {
    mode            ClientMode
    langchainConfig *LangChainConfig
}

// NewLLMClientFactory creates a new factory
func NewLLMClientFactory() *LLMClientFactory {
    mode := ClientMode(os.Getenv("LLM_CLIENT_MODE"))
    if mode == "" {
        mode = ModeHybrid // Default to hybrid for gradual migration
    }
    
    return &LLMClientFactory{
        mode: mode,
        langchainConfig: &LangChainConfig{
            ServiceURL:      os.Getenv("LANGCHAIN_SERVICE_URL"),
            Timeout:         30,
            MaxRetries:      3,
            EnableMemory:    true,
            EnableTelemetry: true,
            CacheEnabled:    true,
        },
    }
}

// CreateClient creates an LLMClient based on user profile and mode
func (f *LLMClientFactory) CreateClient(ctx context.Context, userID string) (LLMClient, error) {
    // Get user's LLM profile
    profile, err := models.GetDefaultLLMProfile(ctx, userID)
    if err != nil || profile == nil {
        return nil, fmt.Errorf("failed to get LLM profile: %w", err)
    }
    
    // Check if profile has LangChain preference
    useLangChain := f.shouldUseLangChain(profile)
    
    if useLangChain {
        return NewLangChainClient(profile, f.langchainConfig)
    }
    
    // Fall back to legacy client
    aiClient, err := NewAIClientWithUserID(userID)
    if err != nil {
        return nil, err
    }
    
    return NewLegacyClientAdapter(aiClient), nil
}

// shouldUseLangChain determines if LangChain should be used
func (f *LLMClientFactory) shouldUseLangChain(profile *models.LLMProfile) bool {
    switch f.mode {
    case ModeLangChain:
        return true
    case ModeLegacy:
        return false
    case ModeHybrid:
        // Check profile metadata for LangChain opt-in
        // This allows gradual user-by-user migration
        return profile.UseLangChain
    default:
        return false
    }
}
```

---

## 3. LangChain Integration Design

### 3.1 Chain Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     LangChain Chain Flow                     │
└─────────────────────────────────────────────────────────────┘

Input (Content + Context)
         ↓
┌────────────────────┐
│  Prompt Template   │ ← Versioned templates from prompts/
│    Resolution      │
└────────────────────┘
         ↓
┌────────────────────┐
│  Context Builder   │ ← Add conversation memory
│                    │ ← Add related strands
└────────────────────┘
         ↓
┌────────────────────┐
│   LLM Chain        │ ← OpenAI/Anthropic/etc.
│   Execution        │
└────────────────────┘
         ↓
┌────────────────────┐
│ Output Parser      │ ← Structured JSON parsing
│  (Pydantic/JSON)   │ ← Validation & error handling
└────────────────────┘
         ↓
┌────────────────────┐
│ Post-Processing    │ ← Tag normalization
│                    │ ← Deduplication
└────────────────────┘
         ↓
Structured Response
```

### 3.2 LangChain Go Integration Approach

Since LangChain doesn't have official Go bindings, we'll use one of these approaches:

**Option A: LangChain gRPC Service (Recommended)**
- Deploy LangChain as a Python microservice
- Expose gRPC/REST API for Go backend
- Maintains full LangChain functionality
- Better separation of concerns

**Option B: langchaingo Library**
- Use community Go implementation (github.com/tmc/langchaingo)
- Native Go integration
- Limited feature set compared to Python
- Simpler deployment

**Recommended: Option A with gRPC**

```
┌──────────────────┐         gRPC/REST          ┌──────────────────┐
│   Go Backend     │ ◄────────────────────────► │  LangChain       │
│   (ZuraBase)     │                             │  Service         │
│                  │                             │  (Python)        │
│  - LLMClient     │                             │  - Chains        │
│  - Factory       │                             │  - Prompts       │
│  - Adapters      │                             │  - Memory        │
└──────────────────┘                             └──────────────────┘
```

### 3.3 LangChain Service API Specification

```protobuf
// backend/internal/langchain/proto/langchain_service.proto

syntax = "proto3";

package langchain;

service LangChainService {
    // Analyze content and extract structured information
    rpc AnalyzeContent(AnalysisRequest) returns (AnalysisResponse);
    
    // Extract tags from content
    rpc ExtractTags(TagExtractionRequest) returns (TagExtractionResponse);
    
    // Generate summary
    rpc GenerateSummary(SummarizationRequest) returns (SummarizationResponse);
    
    // Find related content
    rpc FindRelated(RelatedDiscoveryRequest) returns (RelatedDiscoveryResponse);
    
    // Health check
    rpc HealthCheck(HealthCheckRequest) returns (HealthCheckResponse);
}

message AnalysisRequest {
    string content = 1;
    string source = 2;
    repeated ContextItem context = 3;
    repeated string user_tags = 4;
    AnalysisOptions options = 5;
}

message AnalysisResponse {
    repeated string tags = 1;
    string summary = 2;
    repeated string topics = 3;
    repeated string keywords = 4;
    string sentiment = 5;
    double confidence = 6;
    map<string, string> metadata = 7;
}

message ContextItem {
    string content = 1;
    repeated string tags = 2;
    string summary = 3;
    double relevance = 4;
}

message AnalysisOptions {
    double temperature = 1;
    int32 max_tokens = 2;
    bool include_topics = 3;
    bool include_keywords = 4;
    bool include_sentiment = 5;
}

// Additional message types...
```

### 3.4 Prompts Package Structure

```go
// backend/internal/langchain/prompts/prompt_manager.go

package prompts

import (
    "bytes"
    "fmt"
    "sync"
    "text/template"
)

// PromptTemplate represents a versioned prompt template
type PromptTemplate struct {
    ID          string
    Name        string
    Version     string
    Template    string
    Variables   []string
    Description string
    Examples    []PromptExample
    compiled    *template.Template
}

// PromptExample provides example inputs/outputs for testing
type PromptExample struct {
    Input    map[string]interface{}
    Expected string
}

// PromptManager manages prompt templates
type PromptManager struct {
    templates map[string]*PromptTemplate
    mu        sync.RWMutex
}

// NewPromptManager creates a new prompt manager
func NewPromptManager() (*PromptManager, error) {
    pm := &PromptManager{
        templates: make(map[string]*PromptTemplate),
    }
    
    // Load built-in templates
    if err := pm.loadBuiltInTemplates(); err != nil {
        return nil, err
    }
    
    return pm, nil
}

// GetTemplate retrieves a template by name and version
func (pm *PromptManager) GetTemplate(name, version string) (*PromptTemplate, error) {
    pm.mu.RLock()
    defer pm.mu.RUnlock()
    
    key := fmt.Sprintf("%s:%s", name, version)
    template, exists := pm.templates[key]
    if !exists {
        return nil, fmt.Errorf("template not found: %s", key)
    }
    
    return template, nil
}

// Render renders a template with the given data
func (pt *PromptTemplate) Render(data interface{}) (string, error) {
    if pt.compiled == nil {
        tmpl, err := template.New(pt.ID).Parse(pt.Template)
        if err != nil {
            return "", fmt.Errorf("template compilation failed: %w", err)
        }
        pt.compiled = tmpl
    }
    
    var buf bytes.Buffer
    if err := pt.compiled.Execute(&buf, data); err != nil {
        return "", fmt.Errorf("template execution failed: %w", err)
    }
    
    return buf.String(), nil
}

// loadBuiltInTemplates loads predefined templates
func (pm *PromptManager) loadBuiltInTemplates() error {
    templates := []*PromptTemplate{
        {
            ID:          "tag-extraction-v1",
            Name:        "tag-extraction",
            Version:     "v1",
            Template:    tagExtractionTemplateV1,
            Variables:   []string{"content", "source", "context"},
            Description: "Extracts relevant tags from content",
        },
        {
            ID:          "summarization-v1",
            Name:        "summarization",
            Version:     "v1",
            Template:    summarizationTemplateV1,
            Variables:   []string{"content", "max_length"},
            Description: "Generates concise summaries",
        },
        {
            ID:          "related-discovery-v1",
            Name:        "related-discovery",
            Version:     "v1",
            Template:    relatedDiscoveryTemplateV1,
            Variables:   []string{"content", "candidates"},
            Description: "Finds semantically related content",
        },
    }
    
    for _, template := range templates {
        key := fmt.Sprintf("%s:%s", template.Name, template.Version)
        pm.templates[key] = template
    }
    
    return nil
}
```

### 3.5 Prompt Templates

```go
// backend/internal/langchain/prompts/templates.go

package prompts

const tagExtractionTemplateV1 = `You are an expert content analyzer. Extract relevant tags from the following content.

Content Source: {{.Source}}
{{if .Context}}
Related Context:
{{range .Context}}
- {{.Summary}} (tags: {{join .Tags ", "}})
{{end}}
{{end}}

Content to Analyze:
{{.Content}}

Instructions:
1. Extract 3-7 relevant tags that capture the main topics and themes
2. Tags should be lowercase, single words or short phrases
3. Consider the context of related content when available
4. Focus on actionable, searchable terms
5. Avoid generic tags like "content" or "information"

Return your response as a JSON object with this exact structure:
{
  "tags": ["tag1", "tag2", "tag3"],
  "confidence": 0.95,
  "reasoning": "Brief explanation of tag selection"
}
`

const summarizationTemplateV1 = `You are an expert at creating concise, informative summaries.

Content to Summarize:
{{.Content}}

Maximum Length: {{.MaxLength}} characters

Instructions:
1. Create a clear, concise summary that captures the essence of the content
2. Focus on the main points and key takeaways
3. Use complete sentences
4. Stay within the character limit
5. Maintain the original tone and intent

Return your response as a JSON object:
{
  "summary": "Your summary here",
  "key_points": ["point1", "point2", "point3"]
}
`

const relatedDiscoveryTemplateV1 = `You are an expert at finding semantic relationships between content.

Target Content:
{{.Content}}

Candidate Content Items:
{{range $idx, $candidate := .Candidates}}
{{$idx}}. {{$candidate.Summary}}
   Tags: {{join $candidate.Tags ", "}}
{{end}}

Instructions:
1. Analyze the semantic similarity between the target and each candidate
2. Consider topic overlap, thematic connections, and contextual relevance
3. Rank candidates by relevance (0.0 to 1.0)
4. Provide reasoning for top matches

Return your response as a JSON array:
[
  {
    "id": "candidate_id",
    "similarity_score": 0.85,
    "reason": "Explanation of relationship"
  }
]
`
```

### 3.6 Chains Package

```go
// backend/internal/langchain/chains/chain_manager.go

package chains

import (
    "context"
    "fmt"
    
    "zurabase/internal/langchain/prompts"
    "zurabase/models"
)

// ChainManager manages LangChain chain instances
type ChainManager struct {
    profile       *models.LLMProfile
    config        *ChainConfig
    promptManager *prompts.PromptManager
    llmProvider   LLMProvider
    memory        *MemoryStore
}

// ChainConfig holds chain configuration
type ChainConfig struct {
    Temperature   float64
    MaxTokens     int
    TopP          float64
    EnableCache   bool
    EnableMemory  bool
}

// NewChainManager creates a new chain manager
func NewChainManager(profile *models.LLMProfile, config interface{}) (*ChainManager, error) {
    // Initialize LLM provider based on profile
    provider, err := NewLLMProvider(profile)
    if err != nil {
        return nil, err
    }
    
    // Initialize prompt manager
    promptManager, err := prompts.NewPromptManager()
    if err != nil {
        return nil, err
    }
    
    chainConfig := &ChainConfig{
        Temperature:  0.7,
        MaxTokens:    2000,
        TopP:         0.9,
        EnableCache:  true,
        EnableMemory: true,
    }
    
    cm := &ChainManager{
        profile:       profile,
        config:        chainConfig,
        promptManager: promptManager,
        llmProvider:   provider,
    }
    
    if chainConfig.EnableMemory {
        cm.memory = NewMemoryStore()
    }
    
    return cm, nil
}

// GetAnalysisChain returns a chain for content analysis
func (cm *ChainManager) GetAnalysisChain() *AnalysisChain {
    return &AnalysisChain
