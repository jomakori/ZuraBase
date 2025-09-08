package planner

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

// Planner represents a Markdown-based planning board
type Planner struct {
	ID          string       `json:"id"`
	Title       string       `json:"title"`
	Description string       `json:"description"` // Markdown content
	TemplateID  string       `json:"template_id"`
	CreatedAt   time.Time    `json:"created_at"`
	UpdatedAt   time.Time    `json:"updated_at"`
	Lanes       []PlannerLane `json:"lanes"`
}

// PlannerLane represents a lane in a planner
type PlannerLane struct {
	ID            string       `json:"id"`
	PlannerID     string       `json:"planner_id"`
	TemplateLaneID string      `json:"template_lane_id,omitempty"`
	Title         string       `json:"title"`
	Description   string       `json:"description"` // Markdown content
	Position      int          `json:"position"`
	CreatedAt     time.Time    `json:"created_at"`
	UpdatedAt     time.Time    `json:"updated_at"`
	Cards         []PlannerCard `json:"cards"`
}

// PlannerCard represents a card in a lane with Markdown content
type PlannerCard struct {
	ID        string    `json:"id"`
	LaneID    string    `json:"lane_id"`
	Title     string    `json:"title"`
	Content   string    `json:"content"` // Markdown content
	Position  int       `json:"position"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Mongo collection for planners
var plannerCollection *mongo.Collection

// Initialize sets up the MongoDB collection for the planner package
func Initialize(client *mongo.Client, dbName string) {
	plannerCollection = client.Database(dbName).Collection("planners")
}

// CreatePlanner creates a new planner document in MongoDB
func CreatePlanner(ctx context.Context, title, description, templateID string) (*Planner, error) {
	plannerID := generateID()
	now := time.Now()

	planner := &Planner{
		ID:          plannerID,
		Title:       title,
		Description: description,
		TemplateID:  templateID,
		CreatedAt:   now,
		UpdatedAt:   now,
		Lanes:       []PlannerLane{},
	}

	_, err := plannerCollection.InsertOne(ctx, planner)
	if err != nil {
		return nil, fmt.Errorf("failed to insert planner: %w", err)
	}

	return planner, nil
}

// GetPlanner retrieves a planner by ID with all its lanes and cards
func GetPlanner(ctx context.Context, id string) (*Planner, error) {
	// Minimal logging
	log.Printf("Getting planner with id=%s", id)
	
	result := plannerCollection.FindOne(ctx, bson.M{"id": id})
	if result.Err() != nil {
		return nil, result.Err()
	}
	var planner Planner
	if err := result.Decode(&planner); err != nil {
		return nil, err
	}
	// Ensure Lanes and Cards slices are not nil
	if planner.Lanes == nil {
		planner.Lanes = []PlannerLane{}
	} else {
		for i := range planner.Lanes {
			if planner.Lanes[i].Cards == nil {
				log.Printf("GetPlanner: Fixing nil Cards for lane %s", planner.Lanes[i].ID)
				planner.Lanes[i].Cards = []PlannerCard{}
			}
		}
	}

	log.Printf("GetPlanner: Returning planner with %d lanes", len(planner.Lanes))
	for i, lane := range planner.Lanes {
		log.Printf("GetPlanner: Lane %d: ID=%s, Cards=%v (len=%d)", i, lane.ID, lane.Cards, len(lane.Cards))
	}

	return &planner, nil
}

// UpdatePlanner updates a planner's title and description
func UpdatePlanner(ctx context.Context, id, title, description string) (*Planner, error) {
	log.Printf("Updating planner with id=%s", id)

	filter := bson.M{"id": id}
	update := bson.M{"$set": bson.M{"title": title, "description": description, "updated_at": time.Now()}}

	_, err := plannerCollection.UpdateOne(ctx, filter, update)
	if err != nil {
		return nil, err
	}

	return GetPlanner(ctx, id)
}

	// DeletePlanner deletes a planner and all its lanes and cards
func DeletePlanner(ctx context.Context, id string) error {
	log.Printf("Deleting planner with id=%s", id)
	_, err := plannerCollection.DeleteOne(ctx, bson.M{"id": id})
	return err
}

// ExportPlannerMarkdown exports a planner as a Markdown document
func ExportPlannerMarkdown(ctx context.Context, id string) (string, error) {
	log.Printf("Exporting planner as Markdown with id=%s", id)
	planner, err := GetPlanner(ctx, id)
	if err != nil {
		return "", err
	}
	
	// Build the Markdown document
	markdown := "# " + planner.Title + "\n\n"
	
	if planner.Description != "" {
		markdown += planner.Description + "\n\n"
	}
	
	// Add each lane and its cards
	for _, lane := range planner.Lanes {
		markdown += "## " + lane.Title + "\n\n"
		
		if lane.Description != "" {
			markdown += lane.Description + "\n\n"
		}
		
		// Add cards
		for _, card := range lane.Cards {
			markdown += "### " + card.Title + "\n\n"
			markdown += card.Content + "\n\n"
		}
	}
	
	return markdown, nil
}

// ImportPlannerFromMarkdown creates a planner from a Markdown document
// This is a simplified implementation and would need more robust parsing in production
func ImportPlannerFromMarkdown(ctx context.Context, markdown, templateID string) (*Planner, error) {
	// This would need a proper Markdown parser in a real implementation
	// For now, we'll just create a basic planner with the Markdown content as description
	
	log.Printf("Importing planner from Markdown with templateID=%s", templateID)
	// Extract title from first heading (simplified)
	title := "Imported Planner"
	description := markdown
	
	return CreatePlanner(ctx, title, description, templateID)
}

// HandleCreatePlanner handles POST /planner
func HandleCreatePlanner(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	var request struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		TemplateID  string `json:"template_id"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	
	planner, err := CreatePlanner(r.Context(), request.Title, request.Description, request.TemplateID)
	if err != nil {
		// Log detailed error for server-side diagnosis
		log.Printf("[ERROR] Failed to create planner (title=%s, templateID=%s): %v", request.Title, request.TemplateID, err)
		http.Error(w, fmt.Sprintf("Failed to create planner: %v", err), http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(planner); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

// HandleGetPlanner handles GET /planner/{id}
func HandleGetPlanner(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	// Extract ID from path
	path := r.URL.Path
	if len(path) <= len("/planner/") {
		http.Error(w, "Planner ID is required", http.StatusBadRequest)
		return
	}
	id := path[len("/planner/"):]
	
	planner, err := GetPlanner(r.Context(), id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(planner); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

// HandleUpdatePlanner handles PUT /planner/{id}
func HandleUpdatePlanner(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	// Extract ID from path
	path := r.URL.Path
	if len(path) <= len("/planner/") {
		http.Error(w, "Planner ID is required", http.StatusBadRequest)
		return
	}
	id := path[len("/planner/"):]
	
	var request struct {
		Title       string `json:"title"`
		Description string `json:"description"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	
	planner, err := UpdatePlanner(r.Context(), id, request.Title, request.Description)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(planner); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

// HandleDeletePlanner handles DELETE /planner/{id}
func HandleDeletePlanner(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	// Extract ID from path
	path := r.URL.Path
	if len(path) <= len("/planner/") {
		http.Error(w, "Planner ID is required", http.StatusBadRequest)
		return
	}
	id := path[len("/planner/"):]
	
	if err := DeletePlanner(r.Context(), id); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	
	w.WriteHeader(http.StatusNoContent)
}

// generateID creates a unique ID for database records
func generateID() string {
	// Simple implementation using timestamp and random number
	// In production, use a proper UUID library
	return fmt.Sprintf("%d-%d", time.Now().UnixNano(), time.Now().Unix())
}

// HandleExportPlannerMarkdown handles GET /planner/{id}/export
func HandleExportPlannerMarkdown(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	// Extract ID from path
	path := r.URL.Path
	if len(path) <= len("/planner/") || !strings.HasSuffix(path, "/export") {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}
	id := path[len("/planner/"):len(path)-len("/export")]
	
	markdown, err := ExportPlannerMarkdown(r.Context(), id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "text/markdown")
	w.Header().Set("Content-Disposition", "attachment; filename=\"planner.md\"")
	w.Write([]byte(markdown))
}

// HandleImportPlannerMarkdown handles POST /planner/import
func HandleImportPlannerMarkdown(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	var request struct {
		Markdown   string `json:"markdown"`
		TemplateID string `json:"template_id"`
	}
	
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	
	planner, err := ImportPlannerFromMarkdown(r.Context(), request.Markdown, request.TemplateID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(planner); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}
