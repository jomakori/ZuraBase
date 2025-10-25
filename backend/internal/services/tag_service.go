package services

import (
	"context"
	"log"
	"sort"
	"strings"

	"zurabase/models"
)

// TagService provides methods for tag management and related content discovery
type TagService struct {
	aiClient *AIClient
}

// NewTagService creates a new tag service
func NewTagService(aiClient *AIClient) *TagService {
	return &TagService{
		aiClient: aiClient,
	}
}

// ExtractTagsFromContent uses the AI client to extract tags from content
func (s *TagService) ExtractTagsFromContent(ctx context.Context, content, source string) ([]string, string, error) {
	log.Printf("Extracting tags from content with source: %s", source)

	// Use the AI client to analyze the content
	analysis, err := s.aiClient.AnalyzeContent(ctx, content, source)
	if err != nil {
		log.Printf("Error analyzing content: %v. Falling back to mock analysis.", err)
		// Fall back to mock analysis if the AI service is unavailable
		analysis, err = s.aiClient.MockAnalyzeContent(ctx, content, source)
		if err != nil {
			return nil, "", err
		}
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
	// Start with normalized user tags
	mergedTags := s.normalizeTags(userTags)

	// Add AI tags that aren't already in the list
	for _, tag := range aiTags {
		tag = strings.ToLower(strings.TrimSpace(tag))
		if tag != "" && !contains(mergedTags, tag) {
			mergedTags = append(mergedTags, tag)
		}
	}

	// Sort the final list
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
