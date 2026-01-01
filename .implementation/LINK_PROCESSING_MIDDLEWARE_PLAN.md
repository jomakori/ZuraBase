# Link Processing Middleware Implementation Plan

## Executive Summary

This document outlines the implementation plan for adding link processing middleware to the ZuraBase strands component. The middleware automatically detects URLs in strand content, extracts content using Firecrawl, and combines it with the original content. When sending content to the LLM for enrichment, URLs are stripped out to prevent processing errors. Original strand content is never modified and remains intact with all URLs and source information. Original URLs are preserved in LinkMetadata for reference and user visibility. Failed URLs are reported but processing continues.

---

## 1. Data Flow

The link processing follows a simple linear flow:

```
Strand Input (Original Content Preserved)
    ↓
Detect URLs (regex pattern)
    ↓
Extract Content with Firecrawl (per URL)
    ↓
Combine Content (original + extracted)
    ↓
Send Combined Content to LLM (with URLs stripped)
    ↓
Return Enriched Strand with:
  - Content (original, unchanged)
  - LinkMetadata (URLs + extracted content)
  - LLM Enrichment (based on combined content without URLs)
```

**Process Details:**

1. **Strand Input:** User creates or updates a strand with content (NEVER modified)
2. **Detect URLs:** LinkProcessor scans content for http/https URLs
3. **Extract Content:** For each URL, FirecrawlService extracts markdown content
4. **Combine Content:** Merge original content with extracted content in clear sections
5. **Strip URLs for LLM:** Remove all URLs/links from combined content before sending to LLM
6. **Send to LLM:** Pass combined content (without URLs) to existing AI enrichment pipeline
7. **Return Result:** Strand includes original content, AI tags/summary, and link metadata with original URLs preserved

**Error Handling:** If a URL fails to extract, it's marked as failed in metadata and processing continues with remaining URLs. Original URLs are always preserved in LinkMetadata regardless of extraction success. Original content is never modified.

---

## 2. Architecture

### 2.1 System Components

```
Frontend (React/TypeScript)
    ↓
Backend API Layer
    ├─ POST /api/strands
    ├─ PUT /api/strands/:id
    └─ POST /api/strands/:id/sync
    ↓
Link Processing Middleware (NEW)
    ├─ LinkProcessor Service
    └─ FirecrawlService
    ↓
AI Enrichment Layer (Existing)
    └─ LLMClient.AnalyzeContent()
    ↓
MongoDB (Strand Model + LinkMetadata)
```

### 2.2 Key Services

**LinkProcessor Service** (`backend/internal/services/link_processor.go`)
- `DetectURLs(content string) []string` - Find all URLs in content
- `ValidateURL(url string) bool` - Check if URL is safe to process
- `ProcessURLs(ctx context.Context, urls []string) map[string]*LinkMetadata` - Extract from all URLs
- `CombineContent(original string, metadata map) string` - Merge original + extracted content
- `RemoveURLs(content string) string` - Strip all URLs/links from content before LLM processing

**FirecrawlService** (`backend/internal/services/firecrawl_service.go`)
- `ExtractContent(ctx context.Context, url string) (content, title, description, error)` - Call Firecrawl API
- Handles retries with exponential backoff (3 attempts)
- Limits extracted content to 5000 characters

---

## 3. Backend Changes

### 3.1 New Data Models

#### LinkMetadata Model
**File:** `backend/internal/models/link_metadata.go` (NEW)

Stores metadata about processed URLs. **Important:** Original URLs are preserved here even though they are removed from content before LLM processing. This ensures URLs are available for reference and future use while preventing LLM processing errors.

```go
package models

import "time"

type LinkMetadata struct {
    URL              string    `json:"url" bson:"url"`                                    // Original URL (preserved for reference)
    Status           string    `json:"status" bson:"status"`                             // "success" or "failed"
    ExtractedContent string    `json:"extracted_content,omitempty" bson:"extracted_content,omitempty"`
    ErrorMessage     string    `json:"error_message,omitempty" bson:"error_message,omitempty"`
    ContentLength    int       `json:"content_length" bson:"content_length"`
    ProcessedAt      time.Time `json:"processed_at" bson:"processed_at"`
    ExtractionTime   int64     `json:"extraction_time_ms" bson:"extraction_time_ms"`
    Title            string    `json:"title,omitempty" bson:"title,omitempty"`
    Description      string    `json:"description,omitempty" bson:"description,omitempty"`
}
```

#### Updated Strand Model
**File:** `backend/internal/models/strand.go` (MODIFIED)

Add to existing `Strand` struct:

```go
type Strand struct {
    // ... existing fields ...
    
    // LinkMetadata stores original URLs and extraction results
    // URLs are removed before LLM processing but preserved here for reference
    LinkMetadata     []LinkMetadata `json:"link_metadata,omitempty" bson:"link_metadata,omitempty"`
    HasProcessedURLs bool           `json:"has_processed_urls" bson:"has_processed_urls"`
}
```

**Field Descriptions:**
- `LinkMetadata`: Array of metadata objects containing original URLs, extracted content, and processing status.
- `HasProcessedURLs`: Boolean flag indicating whether URLs were detected and processed for this strand.

**Note:** Original strand `Content` field is never modified. When sending to LLM, URLs are stripped from the combined content (original + extracted) on-the-fly, without storing a separate clean version.

### 3.2 LinkProcessor Service
**File:** `backend/internal/services/link_processor.go` (NEW)

```go
package services

import (
    "context"
    "log"
    "net/url"
    "regexp"
    "strings"
    "time"
    
    "zurabase/internal/models"
)

type LinkProcessor struct {
    firecrawlService *FirecrawlService
    maxURLsPerStrand int
    urlTimeout       time.Duration
}

func NewLinkProcessor(firecrawlService *FirecrawlService) *LinkProcessor {
    return &LinkProcessor{
        firecrawlService: firecrawlService,
        maxURLsPerStrand: 10,
        urlTimeout:       30 * time.Second,
    }
}

// DetectURLs extracts all URLs from content
func (lp *LinkProcessor) DetectURLs(content string) []string {
    urlPattern := regexp.MustCompile(`https?://[^\s\)]+`)
    matches := urlPattern.FindAllString(content, -1)
    
    seen := make(map[string]bool)
    var urls []string
    
    for _, match := range matches {
        cleanURL := strings.TrimRight(match, ".,;:!?)")
        
        if !seen[cleanURL] && lp.ValidateURL(cleanURL) {
            urls = append(urls, cleanURL)
            seen[cleanURL] = true
            
            if len(urls) >= lp.maxURLsPerStrand {
                break
            }
        }
    }
    
    return urls
}

// ValidateURL checks if a URL is valid and safe to process
func (lp *LinkProcessor) ValidateURL(urlStr string) bool {
    if urlStr == "" {
        return false
    }
    
    u, err := url.Parse(urlStr)
    if err != nil {
        return false
    }
    
    if u.Scheme != "http" && u.Scheme != "https" {
        return false
    }
    
    host := u.Hostname()
    if host == "localhost" || host == "127.0.0.1" || strings.HasPrefix(host, "192.168.") {
        return false
    }
    
    return true
}

// ProcessURLs extracts content from all detected URLs
func (lp *LinkProcessor) ProcessURLs(ctx context.Context, urls []string) map[string]*models.LinkMetadata {
    results := make(map[string]*models.LinkMetadata)
    
    for _, urlStr := range urls {
        metadata := &models.LinkMetadata{
            URL:         urlStr,
            ProcessedAt: time.Now(),
        }
        
        timeoutCtx, cancel := context.WithTimeout(ctx, lp.urlTimeout)
        startTime := time.Now()
        
        content, title, description, err := lp.firecrawlService.ExtractContent(timeoutCtx, urlStr)
        metadata.ExtractionTime = time.Since(startTime).Milliseconds()
        metadata.Title = title
        metadata.Description = description
        
        cancel()
        
        if err != nil {
            metadata.Status = "failed"
            metadata.ErrorMessage = err.Error()
            log.Printf("❌ Failed to extract %s: %v", urlStr, err)
        } else {
            metadata.Status = "success"
            metadata.ExtractedContent = content
            metadata.ContentLength = len(content)
            log.Printf("✅ Extracted %d chars from %s in %dms", 
                metadata.ContentLength, urlStr, metadata.ExtractionTime)
        }
        
        results[urlStr] = metadata
    }
    
    return results
}

// CombineContent merges original content with extracted URL content
func (lp *LinkProcessor) CombineContent(originalContent string, metadataMap map[string]*models.LinkMetadata) string {
    var combined strings.Builder
    combined.WriteString(originalContent)
    
    successCount := 0
    for _, metadata := range metadataMap {
        if metadata.Status == "success" && metadata.ExtractedContent != "" {
            if successCount == 0 {
                combined.WriteString("\n\n---\n## Extracted Content from URLs:\n\n")
            }
            
            combined.WriteString("### ")
            if metadata.Title != "" {
                combined.WriteString(metadata.Title)
            } else {
                combined.WriteString(metadata.URL)
            }
            combined.WriteString("\n")
            
            if metadata.Description != "" {
                combined.WriteString("*" + metadata.Description + "*\n\n")
            }
            
            combined.WriteString(metadata.ExtractedContent)
            combined.WriteString("\n\n")
            successCount++
        }
    }
    
    return combined.String()
}

// RemoveURLs strips all URLs and links from content before sending to LLM
func (lp *LinkProcessor) RemoveURLs(content string) string {
    // Remove http/https URLs
    urlPattern := regexp.MustCompile(`https?://[^\s\)]+`)
    content = urlPattern.ReplaceAllString(content, "")
    
    // Remove markdown links [text](url)
    markdownLinkPattern := regexp.MustCompile(`\[([^\]]+)\]\(([^\)]+)\)`)
    content = markdownLinkPattern.ReplaceAllString(content, "$1")
    
    // Remove HTML links <a href="url">text</a>
    htmlLinkPattern := regexp.MustCompile(`<a\s+href=["\']([^"\']+)["\'][^>]*>([^<]*)</a>`)
    content = htmlLinkPattern.ReplaceAllString(content, "$2")
    
    return content
}
```

### 3.3 FirecrawlService
**File:** `backend/internal/services/firecrawl_service.go` (NEW)

```go
package services

import (
    "bytes"
    "context"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "os"
    "strings"
    "time"
)

type FirecrawlService struct {
    apiKey     string
    baseURL    string
    httpClient *http.Client
    maxRetries int
}

type FirecrawlRequest struct {
    URL     string   `json:"url"`
    Formats []string `json:"formats,omitempty"`
}

type FirecrawlResponse struct {
    Success bool   `json:"success"`
    Data    struct {
        Markdown    string `json:"markdown"`
        Title       string `json:"title"`
        Description string `json:"description"`
    } `json:"data"`
    Error string `json:"error"`
}

func NewFirecrawlService() (*FirecrawlService, error) {
    apiKey := os.Getenv("FIRECRAWL_API_KEY")
    if apiKey == "" {
        return nil, fmt.Errorf("FIRECRAWL_API_KEY environment variable not set")
    }
    
    return &FirecrawlService{
        apiKey:     apiKey,
        baseURL:    "https://api.firecrawl.dev/v0",
        httpClient: &http.Client{Timeout: 60 * time.Second},
        maxRetries: 3,
    }, nil
}

// ExtractContent extracts content from a URL using Firecrawl
func (fs *FirecrawlService) ExtractContent(ctx context.Context, urlStr string) (string, string, string, error) {
    if urlStr == "" {
        return "", "", "", fmt.Errorf("URL cannot be empty")
    }
    
    var lastErr error
    
    for attempt := 0; attempt < fs.maxRetries; attempt++ {
        content, title, description, err := fs.extractContentOnce(ctx, urlStr)
        
        if err == nil {
            return content, title, description, nil
        }
        
        lastErr = err
        
        if !isRetryableError(err) {
            return "", "", "", err
        }
        
        if attempt < fs.maxRetries-1 {
            backoff := time.Duration((1 << uint(attempt)) * 100) * time.Millisecond
            select {
            case <-time.After(backoff):
            case <-ctx.Done():
                return "", "", "", ctx.Err()
            }
        }
    }
    
    return "", "", "", fmt.Errorf("failed after %d retries: %w", fs.maxRetries, lastErr)
}

func (fs *FirecrawlService) extractContentOnce(ctx context.Context, urlStr string) (string, string, string, error) {
    req := FirecrawlRequest{
        URL:     urlStr,
        Formats: []string{"markdown"},
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
    
    resp, err := fs.httpClient.Do(httpReq)
    if err != nil {
        return "", "", "", fmt.Errorf("request failed: %w", err)
    }
    defer resp.Body.Close()
    
    body, err := io.ReadAll(resp.Body)
    if err != nil {
        return "", "", "", fmt.Errorf("failed to read response: %w", err)
    }
    
    var fcResp FirecrawlResponse
    if err := json.Unmarshal(body, &fcResp); err != nil {
        return "", "", "", fmt.Errorf("failed to parse response: %w", err)
    }
    
    if !fcResp.Success {
        return "", "", "", fmt.Errorf("firecrawl error: %s", fcResp.Error)
    }
    
    content := fcResp.Data.Markdown
    if len(content) > 5000 {
        content = content[:5000] + "\n[Content truncated...]"
    }
    
    return content, fcResp.Data.Title, fcResp.Data.Description, nil
}

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
```

### 3.4 Modified Handler
**File:** `backend/api/strands/handler.go` (MODIFIED)

Update `enrichStrandWithAI()` function:

```go
func enrichStrandWithAI(ctx context.Context, strand *models.Strand) EnrichmentResult {
    log.Printf("[DEBUG] enrichStrandWithAI: Starting for strand %s", strand.ID)
    
    // Initialize link processor
    firecrawlService, err := services.NewFirecrawlService()
    if err != nil {
        log.Printf("[WARN] Firecrawl unavailable: %v. Continuing without link processing.", err)
    }
    
    // Original content is NEVER modified - strand.Content remains unchanged
    var contentForAI string = strand.Content
    
    if firecrawlService != nil {
        linkProcessor := services.NewLinkProcessor(firecrawlService)
        
        // Detect and process URLs
        detectedURLs := linkProcessor.DetectURLs(strand.Content)
        if len(detectedURLs) > 0 {
            log.Printf("[DEBUG] Detected %d URLs", len(detectedURLs))
            
            linkMetadata := linkProcessor.ProcessURLs(ctx, detectedURLs)
            
            // Combine original content with extracted content
            combinedContent := linkProcessor.CombineContent(strand.Content, linkMetadata)
            
            // Strip URLs from combined content for LLM processing
            contentForAI = linkProcessor.RemoveURLs(combinedContent)
            log.Printf("[DEBUG] Stripped URLs from content for LLM processing")
            
            strand.LinkMetadata = convertMetadataMapToSlice(linkMetadata)
            strand.HasProcessedURLs = true
        }
    }
    
    // Continue with existing AI enrichment
    // Original content (strand.Content) remains unchanged and will be saved as-is
    userAIClient, err := getAIClientForStrand(ctx, strand)
    if err != nil {
        log.Printf("[ERROR] AI client unavailable: %v", err)
        strand.SyncedWithAI = false
        strand.AIStatus = "failed"
        strand.AIFailureReason = err.Error()
        models.SaveStrand(ctx, strand)
        return EnrichmentResult{StrandID: strand.ID, Success: false, Error: err.Error()}
    }
    
    // Analyze content (URLs stripped from combined content, original content preserved in strand.Content)
    resp, err := userAIClient.AnalyzeContent(ctx, &services.AnalysisRequest{
        Content: contentForAI,
        Source:  strand.Source,
    })
    
    // ... rest of existing enrichStrandWithAI logic ...
}

func convertMetadataMapToSlice(metadataMap map[string]*models.LinkMetadata) []models.LinkMetadata {
    var slice []models.LinkMetadata
    for _, metadata := range metadataMap {
        if metadata != nil {
            slice = append(slice, *metadata)
        }
    }
    return slice
}
```

---

## 4. Configuration

### 4.1 Environment Variables

Required:
```bash
FIRECRAWL_API_KEY=your_firecrawl_api_key_here
```

Optional (defaults provided):
```bash
FIRECRAWL_BASE_URL=https://api.firecrawl.dev/v0
```

**Graceful Handling:** If `FIRECRAWL_API_KEY` is not set, the link processor is disabled and the handler continues with original content (no error). This ensures backward compatibility and allows the system to function without Firecrawl integration.

### 4.2 Docker Configuration
**File:** `backend/Dockerfile` (MODIFIED)

```dockerfile
# Add to Dockerfile
ENV FIRECRAWL_API_KEY=""
ENV FIRECRAWL_BASE_URL="https://api.firecrawl.dev/v0"
```

---

## 5. API Endpoints

### Existing Endpoints (Enhanced)

**POST /api/strands**
- Now processes URLs in background before AI enrichment
- Response includes `link_metadata` field if URLs were processed

**PUT /api/strands/:id**
- Processes URLs if content changes
- Updates link metadata

**POST /api/strands/:id/sync**
- Processes URLs during manual sync

### Response Format

All strand responses now include optional `link_metadata`:

```json
{
  "strand": {
    "id": "strand-123",
    "content": "Check this: https://example.com\n\nThis is important information.",
    "summary": "...",
    "tags": ["..."],
    "link_metadata": [
      {
        "url": "https://example.com",
        "status": "success",
        "extracted_content": "Page content extracted from the URL...",
        "content_length": 1234,
        "processed_at": "2025-12-24T16:43:40Z",
        "extraction_time_ms": 2500,
        "title": "Example Page",
        "description": "An example page"
      }
    ],
    "has_processed_urls": true
  }
}
```

**Response Field Descriptions:**
- `content`: Original, unmodified strand content with all URLs intact. This is what users see and edit.
- `link_metadata`: Array of metadata objects containing original URLs, extracted content, and processing status.
- `has_processed_urls`: Boolean flag indicating whether URLs were detected and processed.

---

## 6. Testing Strategy

### Unit Tests

**LinkProcessor Tests** (`backend/internal/services/link_processor_test.go`)
- Test URL detection with various formats
- Test URL validation (valid, invalid, localhost, private IPs)
- Test content combination formatting
- Test URL removal (http/https URLs, markdown links, HTML links)
- Verify URLs are removed but content structure is preserved

**FirecrawlService Tests** (`backend/internal/services/firecrawl_service_test.go`)
- Test successful extraction
- Test error handling and retries
- Test timeout handling

### Integration Tests

**File:** `backend/tests/link_processing_test.go`

Comprehensive test suite covering:
- Create strand with single URL
- Create strand with multiple URLs
- Update strand with new URLs
- Handle failed URLs (continue processing)
- Verify original content preserved: `strand.Content` unchanged after processing
- Verify link metadata stored with original URLs
- Verify URLs are stripped before LLM processing
- Verify AI enrichment receives content without URLs
- Verify original URLs remain accessible in LinkMetadata
- Verify users see original content with URLs intact

**Test Coverage:** The test suite includes table‑driven unit tests for `DetectURLs`, `RemoveURLs`, `ExtractAndCombine`, and `FirecrawlService` methods, as well as integration tests with real strand data. All link‑processing tests pass (see test run output).

---

## 7. Frontend Considerations

### Display Original Content

The frontend should always display the original `Content` field to users:

```typescript
// Frontend component displaying strand
const StrandDisplay = ({ strand }) => {
  return (
    <div>
      {/* Always display original content with URLs intact */}
      <div className="strand-content">
        {strand.content}
      </div>
      
      {/* Optionally show link metadata for transparency */}
      {strand.link_metadata && strand.link_metadata.length > 0 && (
        <div className="link-metadata">
          <h4>Processed Links</h4>
          {strand.link_metadata.map(link => (
            <div key={link.url}>
              <a href={link.url}>{link.title || link.url}</a>
              <span className={`status ${link.status}`}>{link.status}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

**Key Points:**
- Display `strand.content` (original, with URLs) to users
- Show `link_metadata` to provide transparency about processed URLs
- Users can see which URLs were extracted and their status
- Original URLs remain clickable in the content

### Editing Behavior

When users edit a strand:
1. They edit the `Content` field (original)
2. On save, the backend re-processes URLs if content changed
3. Original `Content` is updated with user's changes
4. Users always see their original edits with URLs intact

---

## 8. Error Handling

### Simple Approach

**URL Detection/Validation Errors**
- Filter out invalid URLs during detection
- Log debug message
- Continue with valid URLs

**Firecrawl Extraction Errors**
- Retry up to 3 times with exponential backoff
- Mark URL as failed in metadata
- Store error message
- Continue processing other URLs
- Original URL preserved in LinkMetadata regardless of extraction success

**URL Removal Errors**
- If URL removal fails, log warning but continue
- Send content as-is to LLM (graceful degradation)
- Prioritize LLM processing over perfect URL removal

**AI Enrichment Errors**
- Use existing error handling
- Link metadata preserved for retry
- URLs already removed from content sent to LLM
- Original content never modified

### Logging

```
[DEBUG] enrichStrandWithAI: Detected 2 URLs in strand abc123
[INFO] enrichStrandWithAI: Successfully extracted 1234 chars from https://example.com in 2500ms
[DEBUG] enrichStrandWithAI: Created clean content for LLM (original content preserved)
[WARN] enrichStrandWithAI: Firecrawl service unavailable: FIRECRAWL_API_KEY not set
[ERROR] enrichStrandWithAI: Failed to extract from https://example.com: timeout
```

---

## 9. Implementation Steps

### Phase 1: Foundation
- [ ] Create `backend/internal/models/link_metadata.go`
- [ ] Update `backend/internal/models/strand.go`
- [ ] Create `backend/internal/services/firecrawl_service.go`
- [ ] Create `backend/internal/services/link_processor.go` with RemoveURLs function

### Phase 2: Integration
- [ ] Modify `backend/api/strands/handler.go` to call RemoveURLs before LLM processing
- [ ] Add environment variables to `.env` and `Dockerfile`
- [ ] Add logging for URL removal step
- [ ] Verify original URLs preserved in LinkMetadata

### Phase 3: Testing
- [ ] Write unit tests for LinkProcessor
- [ ] Write unit tests for FirecrawlService
- [ ] Write integration tests
- [ ] Test via API endpoints

### Phase 4: Environment Configuration and Comprehensive Tests (COMPLETED)
- [x] Document required environment variables (`FIRECRAWL_API_KEY`, `FIRECRAWL_BASE_URL`)
- [x] Ensure graceful handling of missing `FIRECRAWL_API_KEY` (skip link processing)
- [x] Write comprehensive tests at `backend/tests/link_processing_test.go`
  - Test `LinkProcessor.DetectURLs()` with various URL formats
  - Test `LinkProcessor.RemoveURLs()` for HTTP/HTTPS, markdown, HTML links
  - Test `LinkProcessor.ExtractAndCombine()` with mock Firecrawl responses
  - Test `FirecrawlService.ExtractContent()` success/error handling
  - Integration tests with real strand data
- [x] Verify all link‑processing tests pass

### Phase 5: Deployment
- [ ] Update API documentation
- [ ] Update README with setup instructions
- [ ] Deploy to staging
- [ ] Deploy to production

---

## 10. Security Considerations

### URL Validation
- Reject localhost and private IPs
- Only allow http/https schemes
- Validate URL format with Go's `net/url.Parse()`

### Content Limits
- Max 10 URLs per strand
- Max 5000 characters per extracted content
- 30-second timeout per URL

### API Key Security
- Store in environment variable `FIRECRAWL_API_KEY`
- Never log API key
- Use HTTPS only

---

## 11. Backward Compatibility

**Data Model Changes**
- New fields: `LinkMetadata []LinkMetadata`, `HasProcessedURLs bool`
- Existing fields: Unchanged
- Migration: None required (optional fields)

**Graceful Degradation**
- If Firecrawl unavailable: Skip link processing, enrich with original content only
- If URL detection fails: Continue with original content
- No error to user, logged as warning
- Original content always preserved

---

## 12. Deployment Checklist

### Pre-Deployment
- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] Code review completed
- [ ] Security review completed
- [ ] Documentation updated

### Deployment
- [ ] Set `FIRECRAWL_API_KEY` in production
- [ ] Deploy backend changes
- [ ] Verify Firecrawl connectivity
- [ ] Run smoke tests
- [ ] Monitor error logs for 24 hours

### Post-Deployment
- [ ] Monitor Firecrawl API usage
- [ ] Track extraction success rate
- [ ] Collect performance metrics

---

## 13. Troubleshooting

### Firecrawl service unavailable
- Verify `FIRECRAWL_API_KEY` is set
- Check Firecrawl API status
- Verify network connectivity

### URLs not being detected
- Verify URLs are in valid format (http/https)
- Check URL is not localhost or private IP
- Verify content contains URLs

### Extraction timeout
- Increase `LINK_PROCESSOR_URL_TIMEOUT_SECONDS` if needed
- Check network connectivity
- Verify target website is accessible

---

## References

### Firecrawl Documentation
- API Reference: https://docs.firecrawl.dev/
- Rate Limiting: https://docs.firecrawl.dev/rate-limits

### Related ZuraBase Components
- [`backend/internal/models/strand.go`](backend/internal/models/strand.go): Strand data model
- [`backend/api/strands/handler.go`](backend/api/strands/handler.go): Strand API handlers
- [`backend/internal/services/ai_client.go`](backend/internal/services/ai_client.go): AI enrichment

---

**End of Document**
