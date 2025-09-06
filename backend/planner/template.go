package planner

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"
)

// PlannerTemplate represents a template for creating planners
type PlannerTemplate struct {
	ID          string                `json:"id"`
	Name        string                `json:"name"`
	Type        string                `json:"type"` // scrum, kanban, personal
	Description string                `json:"description"`
	CreatedAt   time.Time             `json:"created_at"`
	Lanes       []PlannerTemplateLane `json:"lanes,omitempty"`
}

// PlannerTemplateLane represents a predefined lane in a template
type PlannerTemplateLane struct {
	ID          string    `json:"id"`
	TemplateID  string    `json:"template_id"`
	Name        string    `json:"name"`
	Description string    `json:"description"`
	Position    int       `json:"position"`
	CreatedAt   time.Time `json:"created_at"`
}

// InitializeTemplates creates the default templates if they don't exist
func InitializeTemplates(ctx context.Context) error {
	log.Println("Initializing planner templates")
	
	// Check if templates already exist
	var count int
	err := db.QueryRowContext(ctx, "SELECT COUNT(*) FROM planner_template").Scan(&count)
	if err != nil {
		return err
	}
	
	// If templates already exist, skip initialization
	if count > 0 {
		log.Println("Templates already exist, skipping initialization")
		return nil
	}
	
	// Create Scrum template
	scrumTemplateID := generateID()
	_, err = db.ExecContext(ctx, `
		INSERT INTO planner_template (id, name, type, description)
		VALUES ($1, $2, $3, $4)
	`, scrumTemplateID, "Scrum Board", "scrum", "A board for managing Scrum sprints")
	if err != nil {
		return err
	}
	
	// Create Scrum template lanes
	scrumLanes := []struct {
		name        string
		description string
		position    int
	}{
		{"Backlog", "Items that are not yet ready for the current sprint", 1},
		{"To Do", "Items planned for the current sprint", 2},
		{"In Progress", "Items currently being worked on", 3},
		{"Blocked", "Items that are blocked and cannot proceed", 4},
		{"Review", "Items ready for review", 5},
		{"Done", "Completed items", 6},
	}
	
	for _, lane := range scrumLanes {
		_, err = db.ExecContext(ctx, `
			INSERT INTO planner_template_lane (id, template_id, name, description, position)
			VALUES ($1, $2, $3, $4, $5)
		`, generateID(), scrumTemplateID, lane.name, lane.description, lane.position)
		if err != nil {
			return err
		}
	}
	
	// Create Kanban template
	kanbanTemplateID := generateID()
	_, err = db.ExecContext(ctx, `
		INSERT INTO planner_template (id, name, type, description)
		VALUES ($1, $2, $3, $4)
	`, kanbanTemplateID, "Kanban Board", "kanban", "A board for visualizing work in a Kanban system")
	if err != nil {
		return err
	}
	
	// Create Kanban template lanes
	kanbanLanes := []struct {
		name        string
		description string
		position    int
	}{
		{"To Do", "Items that need to be done", 1},
		{"In Progress", "Items currently being worked on", 2},
		{"Blocked", "Items that are blocked and cannot proceed", 3},
		{"Done", "Completed items", 4},
	}
	
	for _, lane := range kanbanLanes {
		_, err = db.ExecContext(ctx, `
			INSERT INTO planner_template_lane (id, template_id, name, description, position)
			VALUES ($1, $2, $3, $4, $5)
		`, generateID(), kanbanTemplateID, lane.name, lane.description, lane.position)
		if err != nil {
			return err
		}
	}
	
	// Create Personal template
	personalTemplateID := generateID()
	_, err = db.ExecContext(ctx, `
		INSERT INTO planner_template (id, name, type, description)
		VALUES ($1, $2, $3, $4)
	`, personalTemplateID, "Personal Board", "personal", "A board for managing personal tasks and projects")
	if err != nil {
		return err
	}
	
	// Create Personal template lanes
	personalLanes := []struct {
		name        string
		description string
		position    int
	}{
		{"Ideas", "Capture ideas and thoughts", 1},
		{"Planning", "Items being planned", 2},
		{"In Progress", "Items currently being worked on", 3},
		{"Blocked", "Items that are blocked and cannot proceed", 4},
		{"Completed", "Finished items", 5},
	}
	
	for _, lane := range personalLanes {
		_, err = db.ExecContext(ctx, `
			INSERT INTO planner_template_lane (id, template_id, name, description, position)
			VALUES ($1, $2, $3, $4, $5)
		`, generateID(), personalTemplateID, lane.name, lane.description, lane.position)
		if err != nil {
			return err
		}
	}
	
	log.Println("Successfully initialized planner templates")
	return nil
}

// GetTemplates returns all available templates
func GetTemplates(ctx context.Context) ([]PlannerTemplate, error) {
	log.Println("Getting all planner templates")
	
	rows, err := db.QueryContext(ctx, `
		SELECT id, name, type, description, created_at
		FROM planner_template
		ORDER BY name
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	
	var templates []PlannerTemplate
	for rows.Next() {
		var template PlannerTemplate
		
		err := rows.Scan(&template.ID, &template.Name, &template.Type, &template.Description, &template.CreatedAt)
		if err != nil {
			return nil, err
		}
		
		templates = append(templates, template)
	}
	
	return templates, nil
}

// GetTemplate returns a specific template with its lanes
func GetTemplate(ctx context.Context, id string) (*PlannerTemplate, error) {
	log.Printf("Getting template: id=%s", id)
	
	template := &PlannerTemplate{ID: id}
	
	err := db.QueryRowContext(ctx, `
		SELECT name, type, description, created_at
		FROM planner_template
		WHERE id = $1
	`, id).Scan(&template.Name, &template.Type, &template.Description, &template.CreatedAt)
	if err != nil {
		return nil, err
	}
	
	rows, err := db.QueryContext(ctx, `
		SELECT id, name, description, position, created_at
		FROM planner_template_lane
		WHERE template_id = $1
		ORDER BY position
	`, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	
	var lanes []PlannerTemplateLane
	for rows.Next() {
		var lane PlannerTemplateLane
		
		err := rows.Scan(&lane.ID, &lane.Name, &lane.Description, &lane.Position, &lane.CreatedAt)
		if err != nil {
			return nil, err
		}
		
		lane.TemplateID = id
		lanes = append(lanes, lane)
	}
	
	template.Lanes = lanes
	return template, nil
}

// HandleGetTemplates handles GET /planner/templates
func HandleGetTemplates(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	templates, err := GetTemplates(r.Context())
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(templates); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

// HandleGetTemplate handles GET /planner/templates/{id}
func HandleGetTemplate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	// Extract ID from path
	path := r.URL.Path
	if len(path) <= len("/planner/templates/") {
		http.Error(w, "Template ID is required", http.StatusBadRequest)
		return
	}
	id := path[len("/planner/templates/"):]
	
	template, err := GetTemplate(r.Context(), id)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(template); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}
