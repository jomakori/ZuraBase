package planner

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strings"
	"time"
)

// Planner represents a Markdown-based planning board
type Planner struct {
	ID          string       `json:"id"`
	Title       string       `json:"title"`
	Description string       `json:"description"` // Markdown content
	TemplateID  string       `json:"template_id"`
	CreatedAt   time.Time    `json:"created_at"`
	UpdatedAt   time.Time    `json:"updated_at"`
	Lanes       []PlannerLane `json:"lanes,omitempty"`
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
	Cards         []PlannerCard `json:"cards,omitempty"`
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

var db *sql.DB

// Initialize sets up the database connection for the planner package
func Initialize(database *sql.DB) {
	db = database
}

// CreatePlanner creates a new planner based on a template
func CreatePlanner(ctx context.Context, title, description, templateID string) (*Planner, error) {
	// Generate a new ID for the planner
	plannerID := generateID()
	
	// Log the operation
	log.Printf("Creating new planner: title=%s, templateID=%s", title, templateID)
	
	// Start a transaction
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	
	// Create the planner
	_, err = tx.ExecContext(ctx, `
		INSERT INTO planner (id, title, description, template_id, created_at, updated_at)
		VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`, plannerID, title, description, templateID)
	if err != nil {
		return nil, err
	}
	
	// Get the template lanes
	rows, err := tx.QueryContext(ctx, `
		SELECT id, name, description, position
		FROM planner_template_lane
		WHERE template_id = $1
		ORDER BY position
	`, templateID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	
	// Create lanes for the planner based on the template
	var lanes []PlannerLane
	for rows.Next() {
		var templateLaneID, name, description string
		var position int
		
		err := rows.Scan(&templateLaneID, &name, &description, &position)
		if err != nil {
			return nil, err
		}
		
		laneID := generateID()
		
		_, err = tx.ExecContext(ctx, `
			INSERT INTO planner_lane (id, planner_id, template_lane_id, title, description, position, created_at, updated_at)
			VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
		`, laneID, plannerID, templateLaneID, name, description, position)
		if err != nil {
			return nil, err
		}
		
		lanes = append(lanes, PlannerLane{
			ID:            laneID,
			PlannerID:     plannerID,
			TemplateLaneID: templateLaneID,
			Title:         name,
			Description:   description,
			Position:      position,
			CreatedAt:     time.Now(),
			UpdatedAt:     time.Now(),
			Cards:         []PlannerCard{},
		})
	}
	
	// Commit the transaction
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	
	// Return the created planner with lanes
	return &Planner{
		ID:          plannerID,
		Title:       title,
		Description: description,
		TemplateID:  templateID,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
		Lanes:       lanes,
	}, nil
}

// GetPlanner retrieves a planner by ID with all its lanes and cards
func GetPlanner(ctx context.Context, id string) (*Planner, error) {
	// Log the operation
	log.Printf("Getting planner: id=%s", id)
	
	// Get the planner
	planner := &Planner{ID: id}
	err := db.QueryRowContext(ctx, `
		SELECT title, description, template_id, created_at, updated_at
		FROM planner
		WHERE id = $1
	`, id).Scan(&planner.Title, &planner.Description, &planner.TemplateID, &planner.CreatedAt, &planner.UpdatedAt)
	if err != nil {
		return nil, err
	}
	
	// Get the lanes
	rows, err := db.QueryContext(ctx, `
		SELECT id, template_lane_id, title, description, position, created_at, updated_at
		FROM planner_lane
		WHERE planner_id = $1
		ORDER BY position
	`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	
	var lanes []PlannerLane
	for rows.Next() {
		var lane PlannerLane
		var templateLaneID sql.NullString
		
		err := rows.Scan(&lane.ID, &templateLaneID, &lane.Title, &lane.Description, &lane.Position, &lane.CreatedAt, &lane.UpdatedAt)
		if err != nil {
			return nil, err
		}
		
		lane.PlannerID = id
		if templateLaneID.Valid {
			lane.TemplateLaneID = templateLaneID.String
		}
		
		// Get the cards for this lane
		cardRows, err := db.QueryContext(ctx, `
			SELECT id, title, content, position, created_at, updated_at
			FROM planner_card
			WHERE lane_id = $1
			ORDER BY position
		`, lane.ID)
		if err != nil {
			return nil, err
		}
		
		var cards []PlannerCard
		for cardRows.Next() {
			var card PlannerCard
			
			err := cardRows.Scan(&card.ID, &card.Title, &card.Content, &card.Position, &card.CreatedAt, &card.UpdatedAt)
			if err != nil {
				cardRows.Close()
				return nil, err
			}
			
			card.LaneID = lane.ID
			cards = append(cards, card)
		}
		cardRows.Close()
		
		lane.Cards = cards
		lanes = append(lanes, lane)
	}
	
	planner.Lanes = lanes
	return planner, nil
}

// UpdatePlanner updates a planner's title and description
func UpdatePlanner(ctx context.Context, id, title, description string) (*Planner, error) {
	log.Printf("Updating planner: id=%s", id)
	
	_, err := db.ExecContext(ctx, `
		UPDATE planner
		SET title = $1, description = $2, updated_at = CURRENT_TIMESTAMP
		WHERE id = $3
	`, title, description, id)
	if err != nil {
		return nil, err
	}
	
	return GetPlanner(ctx, id)
}

// DeletePlanner deletes a planner and all its lanes and cards
func DeletePlanner(ctx context.Context, id string) error {
	log.Printf("Deleting planner: id=%s", id)
	_, err := db.ExecContext(ctx, `DELETE FROM planner WHERE id = $1`, id)
	return err
}

// ExportPlannerMarkdown exports a planner as a Markdown document
func ExportPlannerMarkdown(ctx context.Context, id string) (string, error) {
	log.Printf("Exporting planner as Markdown: id=%s", id)
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
	
	log.Printf("Importing planner from Markdown, templateID=%s", templateID)
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
		http.Error(w, err.Error(), http.StatusInternalServerError)
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
