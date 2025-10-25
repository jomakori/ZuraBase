package strands

import (
	"encoding/json"
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
	aiClient, err = services.NewAIClient()
	if err != nil {
		log.Printf("Warning: AI client initialization failed: %v. Using mock implementation.", err)
		// Continue without failing - we'll use mock implementation
	}

	tagService = services.NewTagService(aiClient)
	return nil
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

// HandleIngestStrand handles POST /strands/ingest
func HandleIngestStrand(w http.ResponseWriter, r *http.Request) {
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

	// Parse request body
	var req StrandRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Validate request
	if req.Content == "" {
		http.Error(w, "Content is required", http.StatusBadRequest)
		return
	}

	if req.Source == "" {
		req.Source = "manual" // Default source
	}

	// Create a new strand
	strand := &models.Strand{
		ID:        uuid.New().String(),
		UserID:    userID,
		Content:   req.Content,
		Source:    req.Source,
		Tags:      req.Tags,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// Enrich with AI if no tags provided
	if len(req.Tags) == 0 {
		tags, summary, err := tagService.ExtractTagsFromContent(r.Context(), req.Content, req.Source)
		if err != nil {
			log.Printf("Error extracting tags: %v", err)
		} else {
			strand.Tags = tags
			strand.Summary = summary
		}
	} else {
		// If user provided tags, still get a summary
		_, summary, err := tagService.ExtractTagsFromContent(r.Context(), req.Content, req.Source)
		if err != nil {
			log.Printf("Error generating summary: %v", err)
		} else {
			strand.Summary = summary
		}
	}

	// Save the strand
	savedStrand, err := models.SaveStrand(r.Context(), strand)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Find related strands
	related, err := tagService.FindRelatedStrands(r.Context(), savedStrand, 5)
	if err != nil {
		log.Printf("Error finding related strands: %v", err)
	} else if len(related) > 0 {
		// Update related IDs
		var relatedIDs []string
		for _, s := range related {
			relatedIDs = append(relatedIDs, s.ID)
		}
		savedStrand.RelatedIDs = relatedIDs
		savedStrand, err = models.SaveStrand(r.Context(), savedStrand)
		if err != nil {
			log.Printf("Error updating related strands: %v", err)
		}
	}

	// Return the saved strand
	response := StrandResponse{
		Strand: savedStrand,
	}
	if err := json.NewEncoder(w).Encode(response); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
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
	if r.Method != http.MethodPut {
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

	// Get the existing strand
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

	// Parse request body
	var req StrandRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	// Update fields
	if req.Content != "" {
		strand.Content = req.Content

		// Re-analyze content if it changed
		tags, summary, err := tagService.ExtractTagsFromContent(r.Context(), req.Content, strand.Source)
		if err != nil {
			log.Printf("Error extracting tags: %v", err)
		} else {
			// If user provided tags, merge them with AI tags
			if len(req.Tags) > 0 {
				strand.Tags = tagService.MergeTags(req.Tags, tags)
			} else {
				strand.Tags = tags
			}
			strand.Summary = summary
		}
	} else if len(req.Tags) > 0 {
		// If only tags were updated
		// Use MergeTags with an empty slice to normalize the tags
		strand.Tags = tagService.MergeTags([]string{}, req.Tags)
	}

	strand.UpdatedAt = time.Now()

	// Save the updated strand
	updatedStrand, err := models.SaveStrand(r.Context(), strand)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	// Return the updated strand
	response := StrandResponse{
		Strand: updatedStrand,
	}
	if err := json.NewEncoder(w).Encode(response); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
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
