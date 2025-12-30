package tests

import (
	"context"
	"os"
	"testing"

	"zurabase/internal/services"
)

// TestFirecrawlIntegration_FacebookURL tests real Firecrawl API with a Facebook share URL.
// This is an integration test that requires FIRECRAWL_API_KEY environment variable.
func TestFirecrawlIntegration_FacebookURL(t *testing.T) {
	apiKey := os.Getenv("FIRECRAWL_API_KEY")
	if apiKey == "" {
		t.Skip("FIRECRAWL_API_KEY not set, skipping integration test")
	}

	fs := services.NewFirecrawlService(apiKey, "")
	ctx := context.Background()
	url := "https://www.facebook.com/share/r/1FLa8nsWBy/"

	content, title, description, err := fs.ExtractContent(ctx, url)
	if err != nil {
		t.Fatalf("ExtractContent failed: %v", err)
	}

	t.Logf("✅ Successfully extracted content from Facebook URL")
	t.Logf("Title: %s", title)
	t.Logf("Description: %s", description)
	t.Logf("Content length: %d chars", len(content))

	// Basic validation
	if content == "" {
		t.Error("Extracted content should not be empty")
	}
	if title == "" {
		t.Error("Title should not be empty")
	}
	// Check for prompt detection (should not happen with real API)
	if len(content) < 10 {
		t.Errorf("Content seems too short: %q", content)
	}
}

// TestFirecrawlIntegration_ExampleURL tests a simple public URL.
func TestFirecrawlIntegration_ExampleURL(t *testing.T) {
	apiKey := os.Getenv("FIRECRAWL_API_KEY")
	if apiKey == "" {
		t.Skip("FIRECRAWL_API_KEY not set, skipping integration test")
	}

	fs := services.NewFirecrawlService(apiKey, "")
	ctx := context.Background()
	url := "https://example.com"

	content, title, description, err := fs.ExtractContent(ctx, url)
	if err != nil {
		t.Fatalf("ExtractContent failed: %v", err)
	}

	t.Logf("✅ Successfully extracted content from example.com")
	t.Logf("Title: %s", title)
	t.Logf("Description: %s", description)
	t.Logf("Content length: %d chars", len(content))

	if content == "" {
		t.Error("Extracted content should not be empty")
	}
}
