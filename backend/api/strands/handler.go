package strands

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"zurabase/internal/services"
	"zurabase/models"

	"github.com/google/uuid"
)

var (
	aiClient   *services.AIClient
	tagService *services.TagService
)

// Initialize sets up the services needed for the strands package
func Initialize() error {
	var err error
	// Initialize with empty user ID for global operations
	aiClient, err = services.NewAIClient()
	if err != nil {
		log.Printf("Warning: AI client initialization failed: %v. Using mock implementation.", err)
		// Continue without failing - we'll use mock implementation
	} else {
		log.Printf("✅ AI client initialized successfully")
		// AI service is available, sync any unsynced strands
		go autoSyncUnsyncedStrands()
	}

	tagService = services.NewTagService(aiClient)
	return nil
}

// getAIClientForUser creates or updates an AI client for a specific user
// This allows using user-specific LLM profiles
func getAIClientForUser(ctx context.Context, userID string) (*services.AIClient, error) {
	// If we don't have a global AI client, we can't create a user-specific one
	if aiClient == nil {
		return nil, fmt.Errorf("global AI client not initialized")
	}

	// Create a new AI client with the user ID
	userAIClient, err := services.NewAIClientWithUserID(userID)
	if err != nil {
		log.Printf("Warning: Failed to create user-specific AI client for user %s: %v", userID, err)
		// Fall back to the global client
		return aiClient, nil
	}

	return userAIClient, nil
}

// autoSyncUnsyncedStrands automatically syncs strands that haven't been synced with AI
func autoSyncUnsyncedStrands() {
	if tagService == nil {
		return
	}

	ctx := context.Background()

	// Get all unsynced strands
	// Note: This is a simplified implementation - in production you'd want to paginate
	// and handle this more carefully for large datasets
	strands, err := models.GetUnsyncedStrands(ctx)
	if err != nil {
		log.Printf("Error getting unsynced strands for auto-sync: %v", err)
		return
	}

	if len(strands) > 0 {
		log.Printf("Auto-syncing %d unsynced strands with AI...", len(strands))
		syncedCount := 0

		for i := range strands {
			// For auto-sync, only sync strands that haven't been synced before
			if !strands[i].SyncedWithAI {
				// Use the same enrichment function we use for new strands
				enrichStrandWithAI(ctx, &strands[i])
				syncedCount++
			}
		}

		log.Printf("✅ Auto-synced %d/%d strands with AI", syncedCount, len(strands))
	}
}

// StrandRequest represents a request to create or update a strand
type StrandRequest struct {
	Content string   `json:"content"`
	Source  string   `json:"source"`
	Tags    []string `json:"tags,omitempty"`
}

// StrandResponse represents the response for a strand operation
type StrandResponse struct {
	Strand  *models.Strand  `json:"strand,omitempty"`
	Strands []models.Strand `json:"strands,omitempty"`
	Tags    []string        `json:"tags,omitempty"`
	Error   string          `json:"error,omitempty"`
	Count   int             `json:"count,omitempty"`
	Page    int             `json:"page,omitempty"`
	Limit   int             `json:"limit,omitempty"`
}

// HandleCreateStrand handles POST /strands
// This is a simplified version that separates strand saving from AI enrichment
func HandleCreateStrand(w http.ResponseWriter, r *http.Request) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("HandleCreateStrand: recovered from panic: %v", r)
			http.Error(w, `{"error": "internal server error due to panic"}`, http.StatusInternalServerError)
		}
	}()

	if r.Method != http.MethodPost {
		http.Error(w, `{"error": "method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	// Get user ID from context (set by auth middleware)
	userID, _ := r.Context().Value("user_id").(string)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Parse request body
	var req StrandRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("HandleCreateStrand: error decoding request body: %v", err)
		http.Error(w, `{"error": "invalid request body"}`, http.StatusBadRequest)
		return
	}

	// Validate request
	if req.Content == "" {
		http.Error(w, `{"error": "content is required"}`, http.StatusBadRequest)
		return
	}

	if req.Source == "" {
		req.Source = "manual" // Default source
	}

	// Create a new strand with basic information
	strand := &models.Strand{
		ID:           uuid.New().String(),
		UserID:       userID,
		Content:      req.Content,
		Source:       req.Source,
		Tags:         req.Tags,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
		SyncedWithAI: false, // Always start as not synced
	}

	// Generate a basic summary regardless of AI availability
	strand.Summary = generateBasicSummary(req.Content)

	// If user didn't provide tags, add source as a tag
	if len(req.Tags) == 0 {
		// Only add source as a tag if it's not already "manual"
		if req.Source != "manual" {
			strand.Tags = []string{strings.ToLower(req.Source)}
		} else {
			strand.Tags = []string{}
		}
	} else {
		// Normalize user-provided tags (lowercase)
		for i, tag := range strand.Tags {
			strand.Tags[i] = strings.ToLower(strings.TrimSpace(tag))
		}

		// Remove duplicates
		strand.Tags = removeDuplicateTags(strand.Tags)
	}

	// Save the strand
	savedStrand, err := models.SaveStrand(r.Context(), strand)
	if err != nil {
		log.Printf("HandleCreateStrand: error saving strand: %v", err)
		response := StrandResponse{
			Error: "Failed to save strand: " + err.Error(),
		}
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(response)
		return
	}

	// Try to enrich with AI in the background if available
	// This doesn't block the response to the user
	if tagService != nil {
		// Create a new background context that won't be canceled when the request ends
		bgCtx := context.Background()

		// Use a separate goroutine with panic recovery to prevent crashes
		go func() {
			defer func() {
				if r := recover(); r != nil {
					log.Printf("RECOVERED from panic in enrichStrandWithAI: %v", r)
				}
			}()
			enrichStrandWithAI(bgCtx, savedStrand)
		}()
	}

	// Return the saved strand immediately
	response := StrandResponse{
		Strand: savedStrand,
	}
	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Printf("HandleCreateStrand: error encoding response: %v", err)
		http.Error(w, `{"error": "failed to encode response"}`, http.StatusInternalServerError)
	}
}

// enrichStrandWithAI processes a strand with AI in the background
// This is called asynchronously to avoid blocking the user response
func enrichStrandWithAI(ctx context.Context, strand *models.Strand) {
	if tagService == nil {
		return
	}

	// Try to get a user-specific AI client
	userAIClient, err := getAIClientForUser(ctx, strand.UserID)
	if err != nil {
		log.Printf("Warning: Using global AI client for strand %s: %v", strand.ID, err)
		// Continue with the global tag service
	} else {
		// Create a temporary tag service with the user-specific AI client
		userTagService := services.NewTagService(userAIClient)
		if userTagService != nil {
			// Use the user-specific tag service
			log.Printf("Using user-specific LLM profile for strand %s", strand.ID)
			enrichStrandWithUserAI(ctx, strand, userTagService)
			return
		}
	}

	// Fall back to global tag service if user-specific one fails
	enrichStrandWithUserAI(ctx, strand, tagService)
}

// enrichStrandWithUserAI is a helper function that uses a specific tag service to enrich a strand
func enrichStrandWithUserAI(ctx context.Context, strand *models.Strand, ts *services.TagService) {
	// Extract tags and summary
	tags, summary, err := ts.ExtractTagsFromContent(ctx, strand.Content, strand.Source)
	if err != nil {
		log.Printf("Error enriching strand %s with AI: %v", strand.ID, err)
		return
	}

	// Ensure all tags are lowercase
	for i, tag := range tags {
		tags[i] = strings.ToLower(strings.TrimSpace(tag))
	}

	// Remove any "manual" tag from AI-generated tags to avoid duplication
	filteredTags := []string{}
	for _, tag := range tags {
		if tag != "manual" {
			filteredTags = append(filteredTags, tag)
		}
	}

	// Merge with any user-provided tags
	if len(strand.Tags) > 0 {
		strand.Tags = tagService.MergeTags(strand.Tags, filteredTags)
	} else {
		strand.Tags = filteredTags
	}

	// Final deduplication and cleanup
	strand.Tags = removeDuplicateTags(strand.Tags)

	strand.Summary = summary
	strand.SyncedWithAI = true
	strand.UpdatedAt = time.Now()

	// Find related strands
	related, err := tagService.FindRelatedStrands(ctx, strand, 5)
	if err != nil {
		log.Printf("Error finding related strands: %v", err)
	} else if len(related) > 0 {
		// Update related IDs
		var relatedIDs []string
		for _, s := range related {
			relatedIDs = append(relatedIDs, s.ID)
		}
		strand.RelatedIDs = relatedIDs
	}

	// Save the enriched strand
	_, err = models.SaveStrand(ctx, strand)
	if err != nil {
		log.Printf("Error saving AI-enriched strand %s: %v", strand.ID, err)
		return
	}

	log.Printf("Successfully enriched strand %s with AI", strand.ID)
}

// HandleGetStrands handles GET /strands
func HandleGetStrands(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	// Get user ID from context (set by auth middleware)
	userID, _ := r.Context().Value("user_id").(string)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Parse query parameters
	query := r.URL.Query()

	// Parse tags
	var tags []string
	if tagParam := query.Get("tags"); tagParam != "" {
		tags = strings.Split(tagParam, ",")
	}

	// Parse pagination parameters
	page := 1
	if pageParam := query.Get("page"); pageParam != "" {
		if p, err := strconv.Atoi(pageParam); err == nil && p > 0 {
			page = p
		}
	}

	limit := 20
	if limitParam := query.Get("limit"); limitParam != "" {
		if l, err := strconv.Atoi(limitParam); err == nil && l > 0 && l <= 100 {
			limit = l
		}
	}

	// Get strands
	strands, err := models.GetStrandsByUser(r.Context(), userID, tags, int64(page), int64(limit))
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Return the strands
	response := StrandResponse{
		Strands: strands,
		Count:   len(strands),
		Page:    page,
		Limit:   limit,
	}
	if err := json.NewEncoder(w).Encode(response); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

// HandleGetStrand handles GET /strands/:id
func HandleGetStrand(w http.ResponseWriter, r *http.Request, id string) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	// Get user ID from context (set by auth middleware)
	userID, _ := r.Context().Value("user_id").(string)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get the strand
	strand, err := models.GetStrand(r.Context(), id)
	if err != nil {
		http.Error(w, "Strand not found", http.StatusNotFound)
		return
	}

	// Verify ownership
	if strand.UserID != userID {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Return the strand
	response := StrandResponse{
		Strand: strand,
	}
	if err := json.NewEncoder(w).Encode(response); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

// HandleUpdateStrand handles PUT /strands/:id
func HandleUpdateStrand(w http.ResponseWriter, r *http.Request, id string) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("HandleUpdateStrand: recovered from panic: %v", r)
			http.Error(w, `{"error": "internal server error due to panic"}`, http.StatusInternalServerError)
		}
	}()

	if r.Method != http.MethodPut {
		http.Error(w, `{"error": "method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	// Get user ID from context (set by auth middleware)
	userID, _ := r.Context().Value("user_id").(string)
	if userID == "" {
		http.Error(w, `{"error": "unauthorized"}`, http.StatusUnauthorized)
		return
	}

	// Create a timeout context to prevent hanging operations
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	// Get the existing strand
	strand, err := models.GetStrand(ctx, id)
	if err != nil {
		log.Printf("HandleUpdateStrand: error getting strand %s: %v", id, err)
		http.Error(w, `{"error": "strand not found"}`, http.StatusNotFound)
		return
	}

	// Verify ownership
	if strand.UserID != userID {
		http.Error(w, `{"error": "unauthorized"}`, http.StatusUnauthorized)
		return
	}

	// Parse request body
	var req StrandRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("HandleUpdateStrand: error decoding request body: %v", err)
		http.Error(w, `{"error": "invalid request body"}`, http.StatusBadRequest)
		return
	}

	// Track if content changed to determine if we need AI reprocessing
	contentChanged := false

	// Update fields
	if req.Content != "" && req.Content != strand.Content {
		strand.Content = req.Content
		contentChanged = true

		// Always update the basic summary immediately
		strand.Summary = generateBasicSummary(req.Content)
	}

	// Update tags if provided
	if len(req.Tags) > 0 {
		if tagService != nil {
			// Use tag service to normalize tags
			strand.Tags = tagService.MergeTags([]string{}, req.Tags)
		} else {
			// Normalize tags manually
			normalizedTags := []string{}
			for _, tag := range req.Tags {
				// Convert to lowercase and trim spaces
				tag = strings.ToLower(strings.TrimSpace(tag))
				if tag != "" && !contains(normalizedTags, tag) {
					normalizedTags = append(normalizedTags, tag)
				}
			}
			strand.Tags = normalizedTags
		}
	}

	// Mark for AI reprocessing if content changed
	if contentChanged {
		strand.SyncedWithAI = false
	}

	strand.UpdatedAt = time.Now()

	// Save the updated strand
	updatedStrand, err := models.SaveStrand(ctx, strand)
	if err != nil {
		log.Printf("HandleUpdateStrand: error saving strand %s: %v", id, err)
		response := StrandResponse{
			Error: "Failed to save strand: " + err.Error(),
		}
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(response)
		return
	}

	// Try to enrich with AI in the background if content changed
	if contentChanged && tagService != nil {
		// Create a new background context that won't be canceled when the request ends
		bgCtx := context.Background()

		// Use a separate goroutine with panic recovery to prevent crashes
		go func() {
			defer func() {
				if r := recover(); r != nil {
					log.Printf("RECOVERED from panic in enrichStrandWithAI during update: %v", r)
				}
			}()
			enrichStrandWithAI(bgCtx, updatedStrand)
		}()
	}

	// Return the updated strand
	response := StrandResponse{
		Strand: updatedStrand,
	}
	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Printf("HandleUpdateStrand: error encoding response: %v", err)
		http.Error(w, `{"error": "failed to encode response"}`, http.StatusInternalServerError)
	}
}

// HandleDeleteStrand handles DELETE /strands/:id
func HandleDeleteStrand(w http.ResponseWriter, r *http.Request, id string) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get user ID from context (set by auth middleware)
	userID, _ := r.Context().Value("user_id").(string)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get the strand to verify ownership
	strand, err := models.GetStrand(r.Context(), id)
	if err != nil {
		http.Error(w, "Strand not found", http.StatusNotFound)
		return
	}

	// Verify ownership
	if strand.UserID != userID {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Delete the strand
	if err := models.DeleteStrand(r.Context(), id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Return success
	w.WriteHeader(http.StatusNoContent)
}

// HandleGetTags handles GET /strands/tags
func HandleGetTags(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	// Get user ID from context (set by auth middleware)
	userID, _ := r.Context().Value("user_id").(string)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get all tags for the user
	tags, err := models.GetAllTags(r.Context(), userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Return the tags
	response := StrandResponse{
		Tags: tags,
	}
	if err := json.NewEncoder(w).Encode(response); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

// HandleSyncStrandsWithAI handles POST /strands/sync
func HandleSyncStrandsWithAI(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	// Get user ID from context (set by auth middleware)
	userID, _ := r.Context().Value("user_id").(string)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Check if AI service is available
	if tagService == nil {
		response := StrandResponse{
			Error: "AI service is not currently available. Please check your AI service configuration.",
		}
		w.WriteHeader(http.StatusServiceUnavailable)
		if err := json.NewEncoder(w).Encode(response); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
		return
	}

	// Try to get a user-specific AI client
	userAIClient, err := getAIClientForUser(r.Context(), userID)
	if err != nil {
		log.Printf("Warning: Using global AI client for sync operation: %v", err)
		// Continue with the global tag service
	} else {
		// Create a temporary tag service with the user-specific AI client
		userTagService := services.NewTagService(userAIClient)
		if userTagService != nil {
			// Use the user-specific tag service for the sync operation
			log.Printf("Using user-specific LLM profile for sync operation")
			tagService = userTagService
		}
	}

	// Get all strands for the user (both synced and unsynced)
	strands, err := models.GetStrandsByUser(r.Context(), userID, nil, 1, 1000) // Get up to 1000 strands
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Count how many strands were synced
	syncedCount := 0

	// Sync each strand with AI (including already synced ones for manual sync)
	for i := range strands {
		// For manual sync, we sync all strands regardless of previous sync status
		// This allows users to get updated AI analysis with more context over time

		// Mark as unsynced to force re-processing
		strands[i].SyncedWithAI = false

		// Use the same enrichment function we use for new strands
		enrichStrandWithAI(r.Context(), &strands[i])
		syncedCount++
	}

	// Return sync results
	response := StrandResponse{
		Count: syncedCount,
	}
	if err := json.NewEncoder(w).Encode(response); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

// generateBasicSummary creates a simple summary when AI service is unavailable
func generateBasicSummary(content string) string {
	if len(content) > 150 {
		return content[:147] + "..."
	}
	return content
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

// Helper function to remove duplicate tags
func removeDuplicateTags(tags []string) []string {
	// Create a map to track seen tags
	seen := make(map[string]bool)
	result := []string{}

	// Add only unseen tags to the result
	for _, tag := range tags {
		// Skip empty tags
		if tag == "" {
			continue
		}

		// Convert to lowercase
		tag = strings.ToLower(strings.TrimSpace(tag))

		if !seen[tag] {
			seen[tag] = true
			result = append(result, tag)
		}
	}

	return result
}

// HandleSyncUnsyncedStrandsWithAI handles POST /strands/sync-unsynced
func HandleSyncUnsyncedStrandsWithAI(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	// Get user ID from context (set by auth middleware)
	userID, _ := r.Context().Value("user_id").(string)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Check if AI service is available
	if tagService == nil {
		response := StrandResponse{
			Error: "AI service is not currently available. Please check your AI service configuration.",
		}
		w.WriteHeader(http.StatusServiceUnavailable)
		if err := json.NewEncoder(w).Encode(response); err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
		}
		return
	}

	// Try to get a user-specific AI client
	userAIClient, err := getAIClientForUser(r.Context(), userID)
	if err != nil {
		log.Printf("Warning: Using global AI client for sync operation: %v", err)
		// Continue with the global tag service
	} else {
		// Create a temporary tag service with the user-specific AI client
		userTagService := services.NewTagService(userAIClient)
		if userTagService != nil {
			// Use the user-specific tag service for the sync operation
			log.Printf("Using user-specific LLM profile for sync operation")
			tagService = userTagService
		}
	}

	// Get only unsynced strands for the user using optimized query
	unsyncedStrands, err := models.GetUnsyncedStrandsByUser(r.Context(), userID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Count how many strands were synced
	syncedCount := 0

	// Sync only unsynced strands with AI
	for i := range unsyncedStrands {
		// Mark as unsynced to force re-processing (though they should already be unsynced)
		unsyncedStrands[i].SyncedWithAI = false

		// Use the same enrichment function we use for new strands
		enrichStrandWithAI(r.Context(), &unsyncedStrands[i])
		syncedCount++
	}

	// Return sync results
	response := StrandResponse{
		Count: syncedCount,
	}
	if err := json.NewEncoder(w).Encode(response); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}
