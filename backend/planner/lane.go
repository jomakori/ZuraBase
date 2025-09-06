package planner

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"
)

// AddLane adds a new lane to a planner
func AddLane(ctx context.Context, plannerID, title, description string, position int) (*PlannerLane, error) {
	log.Printf("Adding lane: plannerID=%s, title=%s, position=%d", plannerID, title, position)
	
	laneID := generateID()
	
	_, err := db.ExecContext(ctx, `
		INSERT INTO planner_lane (id, planner_id, title, description, position, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`, laneID, plannerID, title, description, position)
	if err != nil {
		return nil, err
	}
	
	// Update the positions of other lanes
	_, err = db.ExecContext(ctx, `
		UPDATE planner_lane
		SET position = position + 1, updated_at = CURRENT_TIMESTAMP
		WHERE planner_id = $1 AND position >= $2 AND id != $3
	`, plannerID, position, laneID)
	if err != nil {
		return nil, err
	}
	
	return &PlannerLane{
		ID:          laneID,
		PlannerID:   plannerID,
		Title:       title,
		Description: description,
		Position:    position,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
		Cards:       []PlannerCard{},
	}, nil
}

// UpdateLane updates a lane's title and description
func UpdateLane(ctx context.Context, laneID, title, description string) (*PlannerLane, error) {
	log.Printf("Updating lane: id=%s, title=%s", laneID, title)
	
	_, err := db.ExecContext(ctx, `
		UPDATE planner_lane
		SET title = $1, description = $2, updated_at = CURRENT_TIMESTAMP
		WHERE id = $3
	`, title, description, laneID)
	if err != nil {
		return nil, err
	}
	
	var plannerID string
	var position int
	var createdAt, updatedAt time.Time
	
	err = db.QueryRowContext(ctx, `
		SELECT planner_id, position, created_at, updated_at
		FROM planner_lane
		WHERE id = $1
	`, laneID).Scan(&plannerID, &position, &createdAt, &updatedAt)
	if err != nil {
		return nil, err
	}
	
	return &PlannerLane{
		ID:          laneID,
		PlannerID:   plannerID,
		Title:       title,
		Description: description,
		Position:    position,
		CreatedAt:   createdAt,
		UpdatedAt:   updatedAt,
		Cards:       []PlannerCard{},
	}, nil
}

// DeleteLane deletes a lane and all its cards
func DeleteLane(ctx context.Context, laneID string) error {
	log.Printf("Deleting lane: id=%s", laneID)
	
	// Get the planner ID and position of the lane
	var plannerID string
	var position int
	err := db.QueryRowContext(ctx, `
		SELECT planner_id, position
		FROM planner_lane
		WHERE id = $1
	`, laneID).Scan(&plannerID, &position)
	if err != nil {
		return err
	}
	
	// Start a transaction
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	
	// Delete the lane
	_, err = tx.ExecContext(ctx, `DELETE FROM planner_lane WHERE id = $1`, laneID)
	if err != nil {
		return err
	}
	
	// Update the positions of other lanes
	_, err = tx.ExecContext(ctx, `
		UPDATE planner_lane
		SET position = position - 1, updated_at = CURRENT_TIMESTAMP
		WHERE planner_id = $1 AND position > $2
	`, plannerID, position)
	if err != nil {
		return err
	}
	
	// Commit the transaction
	return tx.Commit()
}

// ReorderLanes updates the positions of lanes in a planner
func ReorderLanes(ctx context.Context, plannerID string, laneIDs []string) error {
	log.Printf("Reordering lanes: plannerID=%s, laneCount=%d", plannerID, len(laneIDs))
	
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	
	for i, laneID := range laneIDs {
		_, err := tx.ExecContext(ctx, `
			UPDATE planner_lane
			SET position = $1, updated_at = CURRENT_TIMESTAMP
			WHERE id = $2 AND planner_id = $3
		`, i+1, laneID, plannerID)
		if err != nil {
			return err
		}
	}
	
	return tx.Commit()
}

// SplitLane splits a lane into two lanes
func SplitLane(ctx context.Context, laneID, newTitle, newDescription string, splitPosition int) (*PlannerLane, error) {
	log.Printf("Splitting lane: id=%s, newTitle=%s, splitPosition=%d", laneID, newTitle, splitPosition)
	
	// Get the lane to split
	var plannerID, title, description string
	var position int
	
	err := db.QueryRowContext(ctx, `
		SELECT planner_id, title, description, position
		FROM planner_lane
		WHERE id = $1
	`, laneID).Scan(&plannerID, &title, &description, &position)
	if err != nil {
		return nil, err
	}
	
	// Start a transaction
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	
	// Create the new lane
	newLaneID := generateID()
	_, err = tx.ExecContext(ctx, `
		INSERT INTO planner_lane (id, planner_id, title, description, position, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`, newLaneID, plannerID, newTitle, newDescription, position+1)
	if err != nil {
		return nil, err
	}
	
	// Update positions of other lanes
	_, err = tx.ExecContext(ctx, `
		UPDATE planner_lane
		SET position = position + 1, updated_at = CURRENT_TIMESTAMP
		WHERE planner_id = $1 AND position > $2 AND id != $3
	`, plannerID, position, newLaneID)
	if err != nil {
		return nil, err
	}
	
	// Move cards after the split position to the new lane
	_, err = tx.ExecContext(ctx, `
		UPDATE planner_card
		SET lane_id = $1, updated_at = CURRENT_TIMESTAMP
		WHERE lane_id = $2 AND position > $3
	`, newLaneID, laneID, splitPosition)
	if err != nil {
		return nil, err
	}
	
	// Reorder cards in the new lane
	_, err = tx.ExecContext(ctx, `
		UPDATE planner_card
		SET position = position - $1, updated_at = CURRENT_TIMESTAMP
		WHERE lane_id = $2
	`, splitPosition, newLaneID)
	if err != nil {
		return nil, err
	}
	
	// Commit the transaction
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	
	// Return the new lane
	return &PlannerLane{
		ID:          newLaneID,
		PlannerID:   plannerID,
		Title:       newTitle,
		Description: newDescription,
		Position:    position + 1,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
		Cards:       []PlannerCard{},
	}, nil
}

// HandleAddLane handles POST /planner/{id}/lane
func HandleAddLane(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	// Extract planner ID from path
	path := r.URL.Path
	if len(path) <= len("/planner/") || !strings.HasSuffix(path, "/lane") {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}
	plannerID := path[len("/planner/"):len(path)-len("/lane")]
	
	// Parse request body
	var request struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		Position    int    `json:"position"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	
	lane, err := AddLane(r.Context(), plannerID, request.Title, request.Description, request.Position)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(lane); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

// HandleUpdateLane handles PUT /planner/{id}/lane/{laneId}
func HandleUpdateLane(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	// Extract lane ID from path
	path := r.URL.Path
	parts := strings.Split(path, "/")
	if len(parts) != 5 || parts[1] != "planner" || parts[3] != "lane" {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}
	laneID := parts[4]
	
	// Parse request body
	var request struct {
		Title       string `json:"title"`
		Description string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	
	lane, err := UpdateLane(r.Context(), laneID, request.Title, request.Description)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(lane); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

// HandleDeleteLane handles DELETE /planner/{id}/lane/{laneId}
func HandleDeleteLane(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	// Extract lane ID from path
	path := r.URL.Path
	parts := strings.Split(path, "/")
	if len(parts) != 5 || parts[1] != "planner" || parts[3] != "lane" {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}
	laneID := parts[4]
	
	if err := DeleteLane(r.Context(), laneID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	
	w.WriteHeader(http.StatusNoContent)
}

// HandleSplitLane handles POST /planner/{id}/lane/{laneId}/split
func HandleSplitLane(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	// Extract lane ID from path
	path := r.URL.Path
	parts := strings.Split(path, "/")
	if len(parts) != 6 || parts[1] != "planner" || parts[3] != "lane" || parts[5] != "split" {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}
	laneID := parts[4]
	
	// Parse request body
	var request struct {
		NewTitle       string `json:"new_title"`
		NewDescription string `json:"new_description"`
		SplitPosition  int    `json:"split_position"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	
	lane, err := SplitLane(r.Context(), laneID, request.NewTitle, request.NewDescription, request.SplitPosition)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(lane); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

// HandleReorderLanes handles PUT /planner/{id}/lanes/reorder
func HandleReorderLanes(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	// Extract planner ID from path
	path := r.URL.Path
	parts := strings.Split(path, "/")
	if len(parts) != 5 || parts[1] != "planner" || parts[3] != "lanes" || parts[4] != "reorder" {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}
	plannerID := parts[2]
	
	// Parse request body
	var request struct {
		LaneIDs []string `json:"lane_ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	
	if err := ReorderLanes(r.Context(), plannerID, request.LaneIDs); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	
	w.WriteHeader(http.StatusNoContent)
}
