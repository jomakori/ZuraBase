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

// LinkProcessor provides functionality to detect, extract, and combine content from URLs.
type LinkProcessor struct {
	firecrawlService *FirecrawlService
	maxURLsPerStrand int
	urlTimeout       time.Duration
}

// NewLinkProcessor creates a new LinkProcessor with the given FirecrawlService.
func NewLinkProcessor(firecrawlService *FirecrawlService) *LinkProcessor {
	return &LinkProcessor{
		firecrawlService: firecrawlService,
		maxURLsPerStrand: 10,
		urlTimeout:       30 * time.Second,
	}
}

// DetectURLs extracts all URLs from content using a regex pattern.
// Returns a slice of unique, validated URLs.
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

// ValidateURL checks if a URL is valid and safe to process.
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

// ProcessURLs extracts content from all detected URLs using FirecrawlService.
// Returns a map from URL to LinkMetadata with extraction results.
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
			if _, ok := err.(*ErrUnsupportedURL); ok {
				metadata.Status = "unsupported"
				metadata.ErrorMessage = err.Error()
				log.Printf("⚠️ URL unsupported by Firecrawl, skipping extraction %s: %v", urlStr, err)
			} else {
				metadata.Status = "failed"
				metadata.ErrorMessage = err.Error()
				log.Printf("❌ Failed to extract %s: %v", urlStr, err)
			}
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

// CombineContent merges original content with extracted URL content.
// Adds a section "## Extracted Content from URLs:" with each successful extraction.
// Special handling: if original content is only URLs, returns just the extracted content
// without markdown section headers to avoid confusing output.
func (lp *LinkProcessor) CombineContent(originalContent string, metadataMap map[string]*models.LinkMetadata) string {
	// Check if original content is only URLs (no meaningful text)
	isOnlyURLs := lp.IsContentOnlyURLs(originalContent)
	
	var combined strings.Builder
	
	// Only add original content if it's not just URLs
	if !isOnlyURLs {
		combined.WriteString(originalContent)
	}

	successCount := 0
	for _, metadata := range metadataMap {
		if metadata.Status == "success" && metadata.ExtractedContent != "" {
			// Only add section header if original content had meaningful text
			if successCount == 0 && !isOnlyURLs {
				combined.WriteString("\n\n---\n## Extracted Content from URLs:\n\n")
			}
			
			// For URL-only strands, add minimal formatting
			if isOnlyURLs && successCount > 0 {
				combined.WriteString("\n\n")
			}
			
			// Add title/URL as context
			if metadata.Title != "" {
				combined.WriteString("### ")
				combined.WriteString(metadata.Title)
				combined.WriteString("\n")
			}
			
			if metadata.Description != "" {
				combined.WriteString("*" + metadata.Description + "*\n\n")
			}
			
			combined.WriteString(metadata.ExtractedContent)
			successCount++
		}
	}
	return combined.String()
}

// IsContentOnlyURLs checks if content consists only of URLs with minimal text
func (lp *LinkProcessor) IsContentOnlyURLs(content string) bool {
	// Trim whitespace
	trimmed := strings.TrimSpace(content)
	if trimmed == "" {
		return true
	}
	
	// Remove all URLs from content
	urlPattern := regexp.MustCompile(`https?://[^\s\)]+`)
	withoutURLs := urlPattern.ReplaceAllString(trimmed, "")
	
	// Remove markdown links
	markdownLinkPattern := regexp.MustCompile(`\[([^\]]+)\]\(([^\)]+)\)`)
	withoutURLs = markdownLinkPattern.ReplaceAllString(withoutURLs, "$1")
	
	// Remove HTML links
	htmlLinkPattern := regexp.MustCompile(`<a\s+href=["\']([^"\']+)["\'][^>]*>([^<]*)</a>`)
	withoutURLs = htmlLinkPattern.ReplaceAllString(withoutURLs, "$2")
	
	// Check if remaining content is meaningful (more than just whitespace/punctuation)
	remaining := strings.TrimSpace(withoutURLs)
	remaining = strings.Trim(remaining, ".,;:!?-\n\r\t ")
	
	return len(remaining) < 10 // Less than 10 chars of meaningful text = URL-only
}

// ExtractAndCombine detects URLs, extracts content, and combines with original content.
// Returns the combined content (original + extracted), a slice of LinkMetadata, and any error.
// If extraction fails for some URLs, processing continues and metadata reflects failures.
func (lp *LinkProcessor) ExtractAndCombine(ctx context.Context, originalContent string, urls []string) (string, []models.LinkMetadata, error) {
	if len(urls) == 0 {
		return originalContent, nil, nil
	}
	metadataMap := lp.ProcessURLs(ctx, urls)
	combined := lp.CombineContent(originalContent, metadataMap)

	// Convert map to slice
	var metadataSlice []models.LinkMetadata
	for _, metadata := range metadataMap {
		if metadata != nil {
			metadataSlice = append(metadataSlice, *metadata)
		}
	}
	return combined, metadataSlice, nil
}

// RemoveURLs strips all URLs and links from content before sending to LLM.
// Removes markdown links, HTML links, and plain http/https URLs.
func (lp *LinkProcessor) RemoveURLs(content string) string {
	// Remove markdown links [text](url) - replace with just the text
	markdownLinkPattern := regexp.MustCompile(`\[([^\]]+)\]\(([^\)]+)\)`)
	content = markdownLinkPattern.ReplaceAllString(content, "$1")

	// Remove HTML links <a href="url">text</a> - replace with just the text
	htmlLinkPattern := regexp.MustCompile(`<a\s+href=["\']([^"\']+)["\'][^>]*>([^<]*)</a>`)
	content = htmlLinkPattern.ReplaceAllString(content, "$2")

	// Remove remaining plain http/https URLs, preserving trailing punctuation
	urlPattern := regexp.MustCompile(`https?://[^\s\)]+`)
	content = urlPattern.ReplaceAllStringFunc(content, func(match string) string {
		// Trim trailing punctuation that is not part of the URL
		trimmed := strings.TrimRight(match, ".,;:!?)")
		// If we trimmed something, keep the punctuation after the URL
		if trimmed != match {
			return match[len(trimmed):]
		}
		return ""
	})

	return content
}

// CleanMarkdownContent removes excessive markdown formatting from extracted content
// to make it more suitable for LLM processing when combined with other content.
func (lp *LinkProcessor) CleanMarkdownContent(content string) string {
	// Remove excessive heading levels (convert ### to plain text, etc.)
	// Keep only single # headings as they're useful for structure
	content = regexp.MustCompile(`(?m)^#{2,}\s+`).ReplaceAllString(content, "")
	
	// Remove excessive blank lines (more than 2 consecutive)
	content = regexp.MustCompile(`\n\n\n+`).ReplaceAllString(content, "\n\n")
	
	// Remove markdown horizontal rules
	content = regexp.MustCompile(`\n---+\n`).ReplaceAllString(content, "\n")
	
	return strings.TrimSpace(content)
}
