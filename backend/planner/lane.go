package planner

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
)

// AddLane adds a new lane to a planner document in MongoDB
func AddLane(ctx context.Context, plannerID, title, description string, position int) (*PlannerLane, error) {
	log.Printf("Adding lane: plannerID=%s, title=%s, position=%d", plannerID, title, position)

	laneID := generateID()
	lane := PlannerLane{
		ID:          laneID,
		PlannerID:   plannerID,
		Title:       title,
		Description: description,
		Position:    position,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
		Cards:       []PlannerCard{},
	}
	if lane.Cards == nil {
		lane.Cards = []PlannerCard{}
	}

	log.Printf("AddLane: Pushing lane with ID=%s, Cards=%v (len=%d)", laneID, lane.Cards, len(lane.Cards))

	// push lane into planner document
	_, err := plannerCollection.UpdateOne(
		ctx,
		bson.M{"id": plannerID},
		bson.M{"$push": bson.M{"lanes": lane}},
	)
	if err != nil {
		return nil, err
	}

	log.Printf("AddLane: Successfully added lane %s to planner %s", laneID, plannerID)
	return &lane, nil
}

 // UpdateLane updates a lane's title and description in MongoDB
func UpdateLane(ctx context.Context, laneID, title, description string) (*PlannerLane, error) {
	log.Printf("Updating lane: id=%s, title=%s", laneID, title)

	filter := bson.M{"lanes.id": laneID}
	update := bson.M{"$set": bson.M{
		"lanes.$.title":       title,
		"lanes.$.description": description,
		"lanes.$.updated_at":  time.Now(),
	}}

	_, err := plannerCollection.UpdateOne(ctx, filter, update)
	if err != nil {
		return nil, err
	}

	// Return updated lane object (minimal)
	updatedLane := &PlannerLane{
		ID:          laneID,
		Title:       title,
		Description: description,
		UpdatedAt:   time.Now(),
		Cards:       []PlannerCard{},
	}
	return updatedLane, nil
}

 // DeleteLane deletes a lane and all its cards in MongoDB
func DeleteLane(ctx context.Context, laneID string) error {
	log.Printf("Deleting lane: id=%s", laneID)

	// Pull lane from array
	_, err := plannerCollection.UpdateOne(
		ctx,
		bson.M{"lanes.id": laneID},
		bson.M{"$pull": bson.M{"lanes": bson.M{"id": laneID}}},
	)
	return err
}

 // ReorderLanes updates the positions of lanes in a planner
func ReorderLanes(ctx context.Context, plannerID string, laneIDs []string) error {
	log.Printf("Reordering lanes: plannerID=%s, laneCount=%d", plannerID, len(laneIDs))

	for i, laneID := range laneIDs {
		filter := bson.M{"id": plannerID, "lanes.id": laneID}
		update := bson.M{"$set": bson.M{"lanes.$.position": i + 1, "lanes.$.updated_at": time.Now()}}
		_, err := plannerCollection.UpdateOne(ctx, filter, update)
		if err != nil {
			return err
		}
	}

	return nil
}

 // SplitLane splits a lane into two lanes in MongoDB
func SplitLane(ctx context.Context, laneID, newTitle, newDescription string, splitPosition int) (*PlannerLane, error) {
	log.Printf("Splitting lane: id=%s, newTitle=%s, splitPosition=%d", laneID, newTitle, splitPosition)

	// Construct new lane
	newLaneID := generateID()
	newLane := PlannerLane{
		ID:          newLaneID,
		Title:       newTitle,
		Description: newDescription,
		Position:    splitPosition + 1,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
		Cards:       []PlannerCard{},
	}
	if newLane.Cards == nil {
		newLane.Cards = []PlannerCard{}
	}

	// Push new lane into planner document containing laneID
	_, err := plannerCollection.UpdateOne(
		ctx,
		bson.M{"lanes.id": laneID},
		bson.M{"$push": bson.M{"lanes": newLane}},
	)
	if err != nil {
		return nil, err
	}

	return &newLane, nil
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

	log.Printf("HandleAddLane: Returning lane with ID=%s, Cards=%v (len=%d)", lane.ID, lane.Cards, len(lane.Cards))

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
