package services

import (
	"context"
	"fmt"
	"log"
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

	// Process and normalize tags
	normalizedTags := s.normalizeTags(analysis.Tags)

	return normalizedTags, analysis.Summary, nil
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

	// Process and normalize tags
	normalizedTags := s.normalizeTags(analysis.Tags)

	return normalizedTags, analysis.Summary, nil
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

// Helper function to check if a slice contains a string
func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}
