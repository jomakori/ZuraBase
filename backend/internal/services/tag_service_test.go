package services

import (
	"context"
	"testing"
)

// TestMarkdownParsing tests the markdown parsing functionality through the public interface
func TestMarkdownParsing(t *testing.T) {
	tests := []struct {
		name            string
		input           string
		expectedSummary string
		expectedTags    []string
	}{
		{
			name: "complete markdown format",
			input: `# Summary
This is a comprehensive summary of the content that captures the main points and key insights.

## Tags
- artificial-intelligence
- machine-learning
- data-analysis
- technology
- future-trends`,
			expectedSummary: "This is a comprehensive summary of the content that captures the main points and key insights.",
			expectedTags:    []string{"artificial-intelligence", "machine-learning", "data-analysis", "technology", "future-trends"},
		},
		{
			name: "markdown with bullet points",
			input: `# Summary
A brief overview of the document discussing various topics.

## Tags
* programming
* software-development
* coding`,
			expectedSummary: "A brief overview of the document discussing various topics.",
			expectedTags:    []string{"programming", "software-development", "coding"},
		},
		{
			name: "markdown with mixed formatting",
			input: `# Summary
This is the main summary text that describes the content.

## Tags
- tag1
* tag2
- tag3`,
			expectedSummary: "This is the main summary text that describes the content.",
			expectedTags:    []string{"tag1", "tag2", "tag3"},
		},
		{
			name: "markdown with template brackets",
			input: `# Summary
Summary content goes here.

## Tags
- [tag1]
- [tag2]
- [tag3]`,
			expectedSummary: "Summary content goes here.",
			expectedTags:    []string{"tag1", "tag2", "tag3"},
		},
		{
			name:            "no markdown sections - fallback behavior",
			input:           `This is just a regular response without markdown formatting. It contains some keywords like technology and innovation.`,
			expectedSummary: "This is just a regular response without markdown formatting. It contains some keywords like technology and innovation.",
			expectedTags:    []string{"technology", "innovation"},
		},
		{
			name:            "empty response",
			input:           "",
			expectedSummary: "",
			expectedTags:    nil,
		},
		{
			name: "only summary section",
			input: `# Summary
This is only a summary without tags section.`,
			expectedSummary: "This is only a summary without tags section.",
			expectedTags:    nil,
		},
		{
			name: "only tags section",
			input: `## Tags
- tag1
- tag2`,
			expectedSummary: "",
			expectedTags:    []string{"tag1", "tag2"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Create a mock AI client that returns the test input
			mockClient := &MockLLMClient{
				response: &AnalysisResponse{
					Summary: tt.input,
					Tags:    []string{}, // Empty tags to test parsing
				},
			}

			tagService := NewTagService(mockClient)
			ctx := context.Background()

			// Test the ExtractTagsFromContent method which uses the markdown parsing internally
			tags, summary, err := tagService.ExtractTagsFromContent(ctx, "test content", "test")
			if err != nil {
				t.Errorf("ExtractTagsFromContent() error = %v", err)
				return
			}

			if summary != tt.expectedSummary {
				t.Errorf("summary = %v, want %v", summary, tt.expectedSummary)
			}

			if len(tags) != len(tt.expectedTags) {
				t.Errorf("tags length = %v, want %v", len(tags), len(tt.expectedTags))
				return
			}

			// Check tags without requiring specific order
			if len(tags) != len(tt.expectedTags) {
				t.Errorf("tags length = %v, want %v", len(tags), len(tt.expectedTags))
				return
			}
			
			// Create maps to compare tag sets
			expectedMap := make(map[string]bool)
			for _, tag := range tt.expectedTags {
				expectedMap[tag] = true
			}
			
			for _, tag := range tags {
				if !expectedMap[tag] {
					t.Errorf("unexpected tag %v, expected tags: %v", tag, tt.expectedTags)
					return
				}
			}
		})
	}
}

// MockLLMClient for testing
type MockLLMClient struct {
	response *AnalysisResponse
	err      error
}

func (m *MockLLMClient) AnalyzeContent(ctx context.Context, req *AnalysisRequest) (*AnalysisResponse, error) {
	return m.response, m.err
}

func (m *MockLLMClient) GetProviderInfo() *ProviderInfo {
	return &ProviderInfo{
		Type:     "mock",
		Provider: "mock",
		Model:    "mock-model",
		Version:  "1.0",
	}
}

func (m *MockLLMClient) Close() error {
	return nil
}
