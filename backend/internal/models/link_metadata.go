package models

import (
	"fmt"
	"time"
)

// LinkMetadata stores metadata about processed URLs.
// Original URLs are preserved here even though they are removed from content before LLM processing.
// This ensures URLs are available for reference and future use while preventing LLM processing errors.
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

// Validate checks if the LinkMetadata has required fields.
func (lm *LinkMetadata) Validate() error {
	if lm.URL == "" {
		return fmt.Errorf("URL is required")
	}
	if lm.Status == "" {
		return fmt.Errorf("status is required")
	}
	if lm.ProcessedAt.IsZero() {
		lm.ProcessedAt = time.Now()
	}
	return nil
}

// IsSuccess returns true if the extraction succeeded.
func (lm *LinkMetadata) IsSuccess() bool {
	return lm.Status == "success"
}

// IsFailed returns true if the extraction failed.
func (lm *LinkMetadata) IsFailed() bool {
	return lm.Status == "failed"
}
