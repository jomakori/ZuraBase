package planner

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"go.mongodb.org/mongo-driver/bson"
)
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

 // InitializeTemplates creates the default templates if they don't exist in MongoDB
func InitializeTemplates(ctx context.Context) error {
	log.Println("Initializing planner templates")

	count, err := plannerCollection.Database().Collection("planner_templates").CountDocuments(ctx, bson.M{})
	if err != nil {
		return err
	}
	if count > 0 {
		log.Println("Templates already exist, skipping initialization")
		return nil
	}

	templates := []PlannerTemplate{
		{
			ID:          generateID(),
			Name:        "Scrum Board",
			Type:        "scrum",
			Description: "A board for managing Scrum sprints",
			CreatedAt:   time.Now(),
			Lanes: []PlannerTemplateLane{
				{ID: generateID(), Name: "Backlog", Description: "Items not ready", Position: 1, CreatedAt: time.Now()},
				{ID: generateID(), Name: "To Do", Description: "Planned items", Position: 2, CreatedAt: time.Now()},
			},
		},
		{
			ID:          generateID(),
			Name:        "Kanban Board",
			Type:        "kanban",
			Description: "A board for visualizing work",
			CreatedAt:   time.Now(),
			Lanes: []PlannerTemplateLane{
				{ID: generateID(), Name: "To Do", Description: "Items to do", Position: 1, CreatedAt: time.Now()},
				{ID: generateID(), Name: "In Progress", Description: "Ongoing items", Position: 2, CreatedAt: time.Now()},
				{ID: generateID(), Name: "Done", Description: "Completed items", Position: 3, CreatedAt: time.Now()},
			},
		},
	}

	// convert to []interface{} for InsertMany
	var docs []interface{}
	for _, t := range templates {
		docs = append(docs, t)
	}

	_, err = plannerCollection.Database().Collection("planner_templates").InsertMany(ctx, docs)
	if err != nil {
		return err
	}

	log.Println("Successfully initialized planner templates in MongoDB")
	return nil
}

 // GetTemplates returns all available templates from MongoDB
func GetTemplates(ctx context.Context) ([]PlannerTemplate, error) {
	log.Println("Getting all planner templates")

	cur, err := plannerCollection.Database().Collection("planner_templates").Find(ctx, bson.M{})
	if err != nil {
		return nil, err
	}
	defer cur.Close(ctx)

	var templates []PlannerTemplate
	for cur.Next(ctx) {
		var t PlannerTemplate
		if err := cur.Decode(&t); err != nil {
			return nil, err
		}
		templates = append(templates, t)
	}
	return templates, nil
}

// GetTemplate returns a specific template with its lanes
 // GetTemplate returns a specific template with its lanes from MongoDB
func GetTemplate(ctx context.Context, id string) (*PlannerTemplate, error) {
	log.Printf("Getting template: id=%s", id)

	var t PlannerTemplate
	err := plannerCollection.Database().Collection("planner_templates").FindOne(ctx, bson.M{"id": id}).Decode(&t)
	if err != nil {
		return nil, err
	}

	return &t, nil
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
