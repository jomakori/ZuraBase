package services

import (
	"context"
	"fmt"
	"log"
	"regexp"
	"sort"
	"strings"

	"zurabase/internal/models"
)

// TagService provides methods for tag management and related content discovery
type TagService struct {
	aiClient LLMClient
}

// NewTagService creates a new tag service
func NewTagService(aiClient LLMClient) *TagService {
	return &TagService{
		aiClient: aiClient,
	}
}

// ExtractTagsFromContent uses the AI client to extract tags from content
func (s *TagService) ExtractTagsFromContent(ctx context.Context, content, source string) ([]string, string, error) {
	log.Printf("Extracting tags from content with source: %s", source)

	// Check if AI client is available
	if s.aiClient == nil {
		return nil, "", fmt.Errorf("AI client not configured. Please set up an LLM profile in settings")
	}

	// Use the AI client to analyze the content
	analysis, err := s.aiClient.AnalyzeContent(ctx, &AnalysisRequest{
		Content: content,
		Source:  source,
	})
	if err != nil {
		log.Printf("Error analyzing content: %v", err)
		return nil, "", fmt.Errorf("AI analysis failed: %w", err)
	}

	// Parse the markdown-formatted response to extract summary and tags
	summary, tags := s.parseMarkdownResponse(analysis.Summary)

	// If parsing failed, fall back to the original behavior
	if summary == "" {
		summary = analysis.Summary
	}
	if len(tags) == 0 {
		tags = analysis.Tags
	}

	// Process and normalize tags
	normalizedTags := s.normalizeTags(tags)

	return normalizedTags, summary, nil
}

// ExtractTagsFromContentWithContext uses the AI client to extract tags from content with additional context
func (s *TagService) ExtractTagsFromContentWithContext(ctx context.Context, content, source string, relatedStrands []models.Strand) ([]string, string, error) {
	log.Printf("Extracting tags from content with source: %s and %d related strands for context", source, len(relatedStrands))

	// Check if AI client is available
	if s.aiClient == nil {
		return nil, "", fmt.Errorf("AI client not configured. Please set up an LLM profile in settings")
	}

	// Build context from related strands
	contextContent := content
	if len(relatedStrands) > 0 {
		contextBuilder := strings.Builder{}
		contextBuilder.WriteString("Previous related content for context:\n")
		for i, related := range relatedStrands {
			if i < 5 { // Limit to 5 related strands to avoid overwhelming the AI
				contextBuilder.WriteString(fmt.Sprintf("- %s (tags: %s)\n", related.Summary, strings.Join(related.Tags, ", ")))
			}
		}
		contextBuilder.WriteString("\nCurrent content to analyze:\n")
		contextBuilder.WriteString(content)
		contextContent = contextBuilder.String()
	}

	// Use the AI client to analyze the content with context
	analysis, err := s.aiClient.AnalyzeContent(ctx, &AnalysisRequest{
		Content: contextContent,
		Source:  source,
	})
	if err != nil {
		log.Printf("Error analyzing content with context: %v", err)
		return nil, "", fmt.Errorf("AI analysis failed: %w", err)
	}

	// Parse the markdown-formatted response to extract summary and tags
	summary, tags := s.parseMarkdownResponse(analysis.Summary)

	// If parsing failed, fall back to the original behavior
	if summary == "" {
		summary = analysis.Summary
	}
	if len(tags) == 0 {
		tags = analysis.Tags
	}

	// Process and normalize tags
	normalizedTags := s.normalizeTags(tags)

	return normalizedTags, summary, nil
}

// normalizeTags processes tags to ensure consistency
func (s *TagService) normalizeTags(tags []string) []string {
	var normalized []string

	for _, tag := range tags {
		// Convert to lowercase and trim spaces
		tag = strings.ToLower(strings.TrimSpace(tag))

		// Skip empty tags
		if tag == "" {
			continue
		}

		// Remove any # prefix if present
		if strings.HasPrefix(tag, "#") {
			tag = tag[1:]
		}

		// Skip if tag is too short
		if len(tag) < 2 {
			continue
		}

		// Add to normalized list if not already present
		if !contains(normalized, tag) {
			normalized = append(normalized, tag)
		}
	}

	// Sort tags alphabetically for consistency
	sort.Strings(normalized)

	return normalized
}

// FindRelatedStrands finds strands related to the given strand based on tag similarity
func (s *TagService) FindRelatedStrands(ctx context.Context, strand *models.Strand, limit int) ([]models.Strand, error) {
	if len(strand.Tags) == 0 {
		return []models.Strand{}, nil
	}

	// Get strands with matching tags, limited to the user's strands
	strands, err := models.GetStrandsByUser(ctx, strand.UserID, strand.Tags, 1, int64(limit+1))
	if err != nil {
		return nil, err
	}

	// Filter out the current strand
	var related []models.Strand
	for _, s := range strands {
		if s.ID != strand.ID {
			related = append(related, s)
		}
	}

	// Limit to requested number
	if len(related) > limit {
		related = related[:limit]
	}

	return related, nil
}

// UpdateStrandTags updates the tags for a strand
func (s *TagService) UpdateStrandTags(ctx context.Context, strandID string, tags []string) (*models.Strand, error) {
	// Get the existing strand
	strand, err := models.GetStrand(ctx, strandID)
	if err != nil {
		return nil, err
	}

	// Normalize the tags
	normalizedTags := s.normalizeTags(tags)

	// Update the strand with new tags
	strand.Tags = normalizedTags

	// Save the updated strand
	return models.SaveStrand(ctx, strand)
}

// MergeTags combines user-provided tags with AI-generated tags
func (s *TagService) MergeTags(userTags, aiTags []string) []string {
	// Normalize both sets of tags
	userTags = s.normalizeTags(userTags)
	aiTags = s.normalizeTags(aiTags)

	// Create a map to prevent duplicates while merging
	tagMap := make(map[string]struct{})

	// Merge user-provided tags first
	for _, tag := range userTags {
		tagLower := strings.ToLower(strings.TrimSpace(tag))
		if tagLower != "" && tagLower != "manual" {
			tagMap[tagLower] = struct{}{}
		}
	}

	// Merge AI-generated tags
	for _, tag := range aiTags {
		tagLower := strings.ToLower(strings.TrimSpace(tag))
		if tagLower != "" && tagLower != "manual" {
			tagMap[tagLower] = struct{}{}
		}
	}

	// Convert the map back to a sorted slice
	var mergedTags []string
	for tag := range tagMap {
		mergedTags = append(mergedTags, tag)
	}
	sort.Strings(mergedTags)

	return mergedTags
}

// parseMarkdownResponse extracts summary and tags from markdown-formatted LLM response
func (s *TagService) parseMarkdownResponse(response string) (string, []string) {
	if response == "" {
		return "", nil
	}

	// Regular expressions to match markdown sections
	// Use (?s) for dotall mode (dot matches newlines) and capture everything until next header or end
	summaryRegex := regexp.MustCompile(`(?s)#\s*Summary\s*\n+(.*?)(?:\n+##|\n+#|\n*$)`)
	tagsRegex := regexp.MustCompile(`(?s)##\s*Tags\s*\n+(.*?)(?:\n+#|\n*$)`)

	var summary string
	var tags []string

	// Extract summary
	summaryFound := false
	if summaryMatch := summaryRegex.FindStringSubmatch(response); len(summaryMatch) > 1 {
		summary = strings.TrimSpace(summaryMatch[1])
		summaryFound = true
		log.Printf("[DEBUG] parseMarkdownResponse: summary found: %q", summary)
	}

	// Extract tags
	tagsFound := false
	if tagsMatch := tagsRegex.FindStringSubmatch(response); len(tagsMatch) > 1 {
		tagsSection := strings.TrimSpace(tagsMatch[1])
		log.Printf("[DEBUG] parseMarkdownResponse: tags section raw: %q", tagsSection)
		tags = s.extractTagsFromMarkdown(tagsSection)
		tagsFound = true
		log.Printf("[DEBUG] parseMarkdownResponse: tags found: %v", tags)
	}

	log.Printf("[DEBUG] parseMarkdownResponse: summaryFound=%v, tagsFound=%v", summaryFound, tagsFound)

	// Enhanced fallback logic - only use fallback when markdown sections are not found
	if !summaryFound && !tagsFound {
		// No markdown sections found - treat entire response as summary and extract tags
		log.Printf("[DEBUG] parseMarkdownResponse: no markdown sections, using fallback")
		summary = strings.TrimSpace(response)
		tags = extractTagsFromResponseAIClient(response)
	} else if !summaryFound && tagsFound {
		// Only tags found (e.g., response started with ## Tags) - summary should be empty
		log.Printf("[DEBUG] parseMarkdownResponse: only tags found, setting summary empty")
		summary = ""
	} else if summaryFound && !tagsFound {
		// Only summary found - check if the summary contains the tags section
		log.Printf("[DEBUG] parseMarkdownResponse: only summary found")
		if strings.Contains(summary, "## Tags") {
			// Split summary to get only the actual summary part
			parts := strings.SplitN(summary, "## Tags", 2)
			summary = strings.TrimSpace(parts[0])
			// Try to extract tags from the tags section
			if len(parts) > 1 {
				tagsSection := strings.TrimSpace(parts[1])
				tags = s.extractTagsFromMarkdown(tagsSection)
			}
		} else {
			// No tags section in summary, try to extract tags from the full response
			tags = extractTagsFromResponseAIClient(response)
		}
	}
	// If both summary and tags were found via markdown parsing, we don't need fallback

	log.Printf("[DEBUG] parseMarkdownResponse: returning summary=%q, tags=%v", summary, tags)
	return summary, tags
}

// extractTagsFromMarkdown extracts tags from markdown bullet points or comma-separated lists
func (s *TagService) extractTagsFromMarkdown(tagsSection string) []string {
	var tags []string

	// Split by newlines to handle bullet points
	lines := strings.Split(tagsSection, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		// Remove bullet points and other markdown formatting
		line = strings.TrimPrefix(line, "-")
		line = strings.TrimPrefix(line, "*")
		line = strings.TrimPrefix(line, "+")
		line = strings.TrimSpace(line)

		// Remove square brackets if present (from the template)
		line = strings.TrimPrefix(line, "[")
		line = strings.TrimSuffix(line, "]")
		line = strings.TrimSpace(line)

		if line != "" {
			tags = append(tags, line)
		}
	}

	return tags
}

// Helper function to check if a slice contains a string
func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}
