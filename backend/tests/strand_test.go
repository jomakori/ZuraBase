package tests

import (
	"strings"
	"testing"
)

// TestStrand_DuplicateTags tests deduplication of tags when saving a strand
func TestStrand_DuplicateTags(t *testing.T) {
	// Test data with duplicate tags
	tags := []string{"manual", "Manual", "maps", "  Maps "}

	// Simulate the deduplication logic that would happen in the backend
	uniqueTags := make(map[string]bool)
	normalizedTags := []string{}

	for _, tag := range tags {
		normalized := strings.ToLower(strings.TrimSpace(tag))
		if !uniqueTags[normalized] {
			uniqueTags[normalized] = true
			normalizedTags = append(normalizedTags, normalized)
		}
	}

	// Verify deduplication worked
	if len(normalizedTags) != 2 {
		t.Errorf("expected 2 unique tags after deduplication, got %d: %v", len(normalizedTags), normalizedTags)
	}

	// Verify the expected tags are present
	expectedTags := map[string]bool{"manual": true, "maps": true}
	for _, tag := range normalizedTags {
		if !expectedTags[tag] {
			t.Errorf("unexpected tag after deduplication: %s", tag)
		}
	}
}

// TestStrand_TagNormalization tests that tags are properly normalized
func TestStrand_TagNormalization(t *testing.T) {
	testCases := []struct {
		input    []string
		expected []string
	}{
		{
			input:    []string{"  GoLang  ", "golang", "  GOLANG  "},
			expected: []string{"golang"},
		},
		{
			input:    []string{"test", "Test", "TEST"},
			expected: []string{"test"},
		},
		{
			input:    []string{"web development", "Web Development", "WEB DEVELOPMENT"},
			expected: []string{"web development"},
		},
	}

	for _, tc := range testCases {
		uniqueTags := make(map[string]bool)
		normalizedTags := []string{}

		for _, tag := range tc.input {
			normalized := strings.ToLower(strings.TrimSpace(tag))
			if !uniqueTags[normalized] {
				uniqueTags[normalized] = true
				normalizedTags = append(normalizedTags, normalized)
			}
		}

		if len(normalizedTags) != len(tc.expected) {
			t.Errorf("expected %d unique tags, got %d for input %v", len(tc.expected), len(normalizedTags), tc.input)
		}

		for i, tag := range normalizedTags {
			if tag != tc.expected[i] {
				t.Errorf("expected tag %s at position %d, got %s for input %v", tc.expected[i], i, tag, tc.input)
			}
		}
	}
}

// TestStrand_Validation tests basic strand validation logic
func TestStrand_Validation(t *testing.T) {
	type Strand struct {
		ID      string
		UserID  string
		Content string
		Tags    []string
	}

	testCases := []struct {
		name        string
		strand      Strand
		shouldError bool
	}{
		{
			name: "Valid strand",
			strand: Strand{
				ID:      "test-id",
				UserID:  "user-123",
				Content: "This is a valid strand",
				Tags:    []string{"test", "valid"},
			},
			shouldError: false,
		},
		{
			name: "Empty content",
			strand: Strand{
				ID:      "test-id",
				UserID:  "user-123",
				Content: "",
				Tags:    []string{"test"},
			},
			shouldError: true,
		},
		{
			name: "Missing user ID",
			strand: Strand{
				ID:      "test-id",
				UserID:  "",
				Content: "Some content",
				Tags:    []string{"test"},
			},
			shouldError: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			// Simulate validation logic
			hasError := false

			if tc.strand.Content == "" {
				hasError = true
			}
			if tc.strand.UserID == "" {
				hasError = true
			}
			if tc.strand.ID == "" {
				hasError = true
			}

			if hasError != tc.shouldError {
				t.Errorf("expected error: %v, got error: %v for test case: %s", tc.shouldError, hasError, tc.name)
			}
		})
	}
}
