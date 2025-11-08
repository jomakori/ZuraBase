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
		log.Printf("Warning: AI client initialization failed: %v. AI features will use user-specific LLM profiles.", err)
		// Don't create a global AI client - rely on user-specific LLM profiles
		aiClient = nil
		tagService = nil
	} else {
		log.Printf("✅ AI client initialized successfully")
		tagService = services.NewTagService(aiClient)
		// AI service is available, sync any unsynced strands
		go autoSyncUnsyncedStrands()
	}

	return nil
}

// getAIClientForUser creates or updates an AI client for a specific user
// This allows using user-specific LLM profiles
func getAIClientForUser(ctx context.Context, userID string) (*services.AIClient, error) {
	// Try to create a user-specific AI client from their LLM profile
	userAIClient, err := services.NewAIClientWithUserID(userID)
	if err != nil {
		// If no user-specific profile exists, try to fall back to global client
		if aiClient != nil {
			log.Printf("Warning: Failed to create user-specific AI client for user %s: %v. Using global client.", userID, err)
			return aiClient, nil
		}
		// No global client and no user profile - return error
		return nil, fmt.Errorf("no AI client available: %w", err)
	}

	return userAIClient, nil
}

// autoSyncUnsyncedStrands automatically syncs strands that haven't been synced with AI
func autoSyncUnsyncedStrands() {
	if tagService == nil {
		log.Println("⏭️ Skipping auto-sync: tagService not initialized")
		return
	}

	ctx := context.Background()
	strands, err := models.GetUnsyncedStrands(ctx)
	if err != nil {
		log.Printf("⚠️ Could not fetch unsynced strands: %v", err)
		return
	}

	if len(strands) == 0 {
		log.Println("✅ No unsynced strands to process")
		return
	}

	log.Printf("Starting simplified AI auto-sync for %d strands...", len(strands))
	for i := range strands {
		str := &strands[i]
		if !str.SyncedWithAI {
			log.Printf("→ Syncing strand %s", str.ID)
			result := enrichStrandWithAI(ctx, str)
			if result.Success {
				log.Printf("✓ Synced strand %s successfully", str.ID)
			} else {
				log.Printf("✗ Failed syncing strand %s: %s", str.ID, result.Error)
			}
			time.Sleep(500 * time.Millisecond) // prevent service overwhelm
		}
	}
	log.Println("🏁 Simplified AI auto-sync complete")
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

// EnrichmentResult represents the result of an AI enrichment operation
type EnrichmentResult struct {
	StrandID string `json:"strand_id"`
	Success  bool   `json:"success"`
	Error    string `json:"error,omitempty"`
}

// SyncResponse represents the response for a sync operation
type SyncResponse struct {
	Status  string `json:"status"`
	Message string `json:"message"`
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
			result := enrichStrandWithAI(bgCtx, savedStrand)
			if !result.Success {
				log.Printf("Background enrichment failed for strand %s: %s", result.StrandID, result.Error)
			}
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
func enrichStrandWithAI(ctx context.Context, strand *models.Strand) EnrichmentResult {
	userAIClient, err := getAIClientForUser(ctx, strand.UserID)
	if err != nil {
		log.Printf("⚠️ AI client unavailable for strand %s: %v", strand.ID, err)
		strand.SyncedWithAI = false
		models.SaveStrand(ctx, strand)
		return EnrichmentResult{StrandID: strand.ID, Success: false, Error: err.Error()}
	}

	userTagService := services.NewTagService(userAIClient)
	if userTagService == nil {
		log.Printf("⚠️ Failed to create tag service for strand %s", strand.ID)
		strand.SyncedWithAI = false
		models.SaveStrand(ctx, strand)
		return EnrichmentResult{StrandID: strand.ID, Success: false, Error: "Failed to create tag service"}
	}

	// Analyze content directly and persist updates without intermediate service layering
	resp, err := userAIClient.AnalyzeContent(ctx, strand.Content, strand.Source)
	if err != nil {
		log.Printf("❌ AI analysis failed for strand %s: %v", strand.ID, err)
		strand.SyncedWithAI = false
		models.SaveStrand(ctx, strand)
		return EnrichmentResult{StrandID: strand.ID, Success: false, Error: err.Error()}
	}

	if resp == nil {
		log.Printf("❌ AI returned nil response for strand %s", strand.ID)
		strand.SyncedWithAI = false
		models.SaveStrand(ctx, strand)
		return EnrichmentResult{StrandID: strand.ID, Success: false, Error: "AI response nil"}
	}

	// Apply enrichment directly
	strand.Tags = resp.Tags
	strand.Summary = resp.Summary
	strand.SyncedWithAI = true
	strand.UpdatedAt = time.Now()
	models.SaveStrand(ctx, strand)
	log.Printf("✅ Strand %s successfully synced with AI at %s", strand.ID, strand.UpdatedAt.Format(time.RFC3339))

	return EnrichmentResult{StrandID: strand.ID, Success: true}
}

// enrichStrandWithUserAI is a helper function that uses a specific tag service to enrich a strand
func enrichStrandWithUserAI(ctx context.Context, strand *models.Strand, ts *services.TagService) EnrichmentResult {
	log.Printf("Tag extraction started for strand %s...", strand.ID)

	// Extract tags and summary
	tags, summary, err := ts.ExtractTagsFromContent(ctx, strand.Content, strand.Source)
	if err != nil {
		log.Printf("Error enriching strand %s with AI: %v", strand.ID, err)
		return EnrichmentResult{
			StrandID: strand.ID,
			Success:  false,
			Error:    fmt.Sprintf("AI enrichment failed: %v", err),
		}
	}

	log.Printf("AI enrichment completed for strand %s", strand.ID)

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
		strand.Tags = ts.MergeTags(strand.Tags, filteredTags)
	} else {
		strand.Tags = filteredTags
	}

	// Final deduplication and cleanup
	strand.Tags = removeDuplicateTags(strand.Tags)

	strand.Summary = summary
	strand.SyncedWithAI = true
	strand.UpdatedAt = time.Now()

	// Add sync log entry
	syncLog := models.SyncLog{
		Timestamp:  time.Now(),
		Summary:    summary,
		Tags:       strand.Tags,
		SyncedByAI: true,
		Notes:      "Automatic AI enrichment",
	}

	// Initialize sync history if nil
	if strand.SyncHistory == nil {
		strand.SyncHistory = []models.SyncLog{}
	}
	strand.SyncHistory = append(strand.SyncHistory, syncLog)

	// Find related strands
	related, err := ts.FindRelatedStrands(ctx, strand, 5)
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
		return EnrichmentResult{
			StrandID: strand.ID,
			Success:  false,
			Error:    fmt.Sprintf("Failed to save enriched strand: %v", err),
		}
	}

	log.Printf("Database updated for strand %s", strand.ID)
	log.Printf("Successfully enriched strand %s with AI", strand.ID)

	return EnrichmentResult{
		StrandID: strand.ID,
		Success:  true,
	}
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
			// Use tag service to normalize tags and ensure they are unique
			strand.Tags = tagService.MergeTags([]string{}, req.Tags)
		} else {
			// Normalize tags manually
			normalizedTags := []string{}
			seen := make(map[string]struct{})
			for _, tag := range req.Tags {
				tag = strings.ToLower(strings.TrimSpace(tag))
				if tag == "" || tag == "manual" {
					continue
				}
				if _, exists := seen[tag]; !exists {
					normalizedTags = append(normalizedTags, tag)
					seen[tag] = struct{}{}
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

// HandleSyncStrand handles POST /strands/:id/sync
func HandleSyncStrand(w http.ResponseWriter, r *http.Request, id string) {
	if r.Method != http.MethodPost {
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

	// Get the strand
	strand, err := models.GetStrand(r.Context(), id)
	if err != nil {
		http.Error(w, `{"error": "strand not found"}`, http.StatusNotFound)
		return
	}

	// Verify ownership
	if strand.UserID != userID {
		http.Error(w, `{"error": "unauthorized"}`, http.StatusUnauthorized)
		return
	}

	// Mark as unsynced to force re-processing
	strand.SyncedWithAI = false

	// Spawn background goroutine for enrichment using independent context
	bgCtx := context.Background()
	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("RECOVERED from panic in HandleSyncStrand enrichment: %v", r)
			}
		}()

		result := enrichStrandWithAI(bgCtx, strand)
		if !result.Success {
			log.Printf("Sync enrichment failed for strand %s: %s", result.StrandID, result.Error)
		} else {
			log.Printf("Sync completed successfully for strand %s", result.StrandID)
		}
	}()

	// Return immediate response
	response := SyncResponse{
		Status:  "success",
		Message: "Strand sync initiated successfully",
	}
	w.WriteHeader(http.StatusOK)
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

// HandleGetSyncHistory handles GET /strands/:id/sync-history
func HandleGetSyncHistory(w http.ResponseWriter, r *http.Request, id string) {
	if r.Method != http.MethodGet {
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

	// Get the strand
	strand, err := models.GetStrand(r.Context(), id)
	if err != nil {
		http.Error(w, `{"error": "strand not found"}`, http.StatusNotFound)
		return
	}

	// Verify ownership
	if strand.UserID != userID {
		http.Error(w, `{"error": "unauthorized"}`, http.StatusUnauthorized)
		return
	}

	// Return sync history
	response := map[string]interface{}{
		"sync_history": strand.SyncHistory,
	}
	if err := json.NewEncoder(w).Encode(response); err != nil {
		http.Error(w, `{"error": "failed to encode response"}`, http.StatusInternalServerError)
	}
}

// RollbackRequest represents a request to rollback to a specific sync version
type RollbackRequest struct {
	Timestamp string `json:"timestamp"`
	SyncIndex int    `json:"sync_index,omitempty"`
}

// HandleRollbackStrand handles POST /strands/:id/rollback
func HandleRollbackStrand(w http.ResponseWriter, r *http.Request, id string) {
	if r.Method != http.MethodPost {
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

	// Get the strand
	strand, err := models.GetStrand(r.Context(), id)
	if err != nil {
		http.Error(w, `{"error": "strand not found"}`, http.StatusNotFound)
		return
	}

	// Verify ownership
	if strand.UserID != userID {
		http.Error(w, `{"error": "unauthorized"}`, http.StatusUnauthorized)
		return
	}

	// Parse request body
	var req RollbackRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("HandleRollbackStrand: error decoding request body: %v", err)
		http.Error(w, `{"error": "invalid request body"}`, http.StatusBadRequest)
		return
	}

	// Find the sync log to rollback to
	var targetLog *models.SyncLog
	if req.Timestamp != "" {
		// Find by timestamp
		for i := range strand.SyncHistory {
			if strand.SyncHistory[i].Timestamp.Format(time.RFC3339) == req.Timestamp {
				targetLog = &strand.SyncHistory[i]
				break
			}
		}
	} else if req.SyncIndex >= 0 && req.SyncIndex < len(strand.SyncHistory) {
		// Find by index
		targetLog = &strand.SyncHistory[req.SyncIndex]
	}

	if targetLog == nil {
		http.Error(w, `{"error": "sync log not found"}`, http.StatusNotFound)
		return
	}

	// Store current state before rollback
	currentSummary := strand.Summary
	currentTags := strand.Tags

	// Rollback to the target version
	strand.Summary = targetLog.Summary
	strand.Tags = targetLog.Tags
	strand.UpdatedAt = time.Now()

	// Add a new sync log entry for the rollback
	rollbackLog := models.SyncLog{
		Timestamp:  time.Now(),
		Summary:    targetLog.Summary,
		Tags:       targetLog.Tags,
		SyncedByAI: false,
		Notes:      fmt.Sprintf("Rolled back to version from %s", targetLog.Timestamp.Format(time.RFC3339)),
	}

	// Initialize sync history if nil
	if strand.SyncHistory == nil {
		strand.SyncHistory = []models.SyncLog{}
	}
	strand.SyncHistory = append(strand.SyncHistory, rollbackLog)

	// Save the updated strand
	updatedStrand, err := models.SaveStrand(r.Context(), strand)
	if err != nil {
		log.Printf("HandleRollbackStrand: error saving strand %s: %v", id, err)
		// Restore original state
		strand.Summary = currentSummary
		strand.Tags = currentTags
		http.Error(w, `{"error": "failed to rollback strand"}`, http.StatusInternalServerError)
		return
	}

	// Return the updated strand
	response := StrandResponse{
		Strand: updatedStrand,
	}
	if err := json.NewEncoder(w).Encode(response); err != nil {
		log.Printf("HandleRollbackStrand: error encoding response: %v", err)
		http.Error(w, `{"error": "failed to encode response"}`, http.StatusInternalServerError)
	}
}
