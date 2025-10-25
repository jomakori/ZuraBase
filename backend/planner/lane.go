package planner

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sort"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
)

// AddLane adds a new lane to a planner document in MongoDB with position-aware insertion
func AddLane(ctx context.Context, plannerID, title, description, color string, position int) (*PlannerLane, error) {
	log.Printf("Adding lane: plannerID=%s, title=%s, position=%d", plannerID, title, position)

	// First, get the current planner to determine proper positioning
	var planner Planner
	err := plannerCollection.FindOne(ctx, bson.M{"id": plannerID}).Decode(&planner)
	if err != nil {
		return nil, err
	}

	laneID := GenerateID()
	lane := PlannerLane{
		ID:          laneID,
		PlannerID:   plannerID,
		Title:       title,
		Description: description,
		Color:       color,
		Position:    position,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
		Cards:       []PlannerCard{},
	}
	if lane.Cards == nil {
		lane.Cards = []PlannerCard{}
	}

	log.Printf("AddLane: Adding lane with ID=%s at position %d", laneID, position)

	// Shift positions of existing lanes to make room for the new lane
	for i := range planner.Lanes {
		if planner.Lanes[i].Position >= position {
			_, err := plannerCollection.UpdateOne(
				ctx,
				bson.M{"id": plannerID, "lanes.id": planner.Lanes[i].ID},
				bson.M{"$inc": bson.M{"lanes.$.position": 1}},
			)
			if err != nil {
				return nil, err
			}
		}
	}

	// Insert the new lane
	_, err = plannerCollection.UpdateOne(
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
func UpdateLane(ctx context.Context, laneID, title, description, color string) (*PlannerLane, error) {
	log.Printf("Updating lane: id=%s, title=%s", laneID, title)

	filter := bson.M{"lanes.id": laneID}
	update := bson.M{"$set": bson.M{
		"lanes.$.title":       title,
		"lanes.$.description": description,
		"lanes.$.color":       color,
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
		Color:       color,
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

// SplitLane splits a lane into two grouped lanes in MongoDB, redistributing cards atomically
func SplitLane(ctx context.Context, laneID, newTitle, newDescription, newColor string, splitPosition int) (*PlannerLane, error) {
	log.Printf("Splitting lane: id=%s, newTitle=%s, splitPosition=%d", laneID, newTitle, splitPosition)

	// Find the planner with the requested lane
	var planner Planner
	err := plannerCollection.FindOne(ctx, bson.M{"lanes.id": laneID}).Decode(&planner)
	if err != nil {
		return nil, err
	}

	// Locate the original lane
	var originalLane *PlannerLane
	for i := range planner.Lanes {
		if planner.Lanes[i].ID == laneID {
			originalLane = &planner.Lanes[i]
			break
		}
	}
	if originalLane == nil {
		return nil, fmt.Errorf("original lane not found: %s", laneID)
	}

	// Determine template_lane_id
	templateID := originalLane.TemplateLaneID
	if templateID == "" {
		templateID = originalLane.ID
	}

	// Split cards into two sets
	cardsToKeep := []PlannerCard{}
	cardsToMove := []PlannerCard{}
	if splitPosition > len(originalLane.Cards) {
		splitPosition = len(originalLane.Cards)
	}
	cardsToKeep = append(cardsToKeep, originalLane.Cards[:splitPosition]...)
	cardsToMove = append(cardsToMove, originalLane.Cards[splitPosition:]...)

	// Construct new lane
	newLaneID := GenerateID()
	newLane := PlannerLane{
		ID:             newLaneID,
		PlannerID:      planner.ID,
		Title:          newTitle,
		Description:    newDescription,
		Color:          newColor,
		Position:       originalLane.Position + 1,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
		Cards:          cardsToMove,
		TemplateLaneID: templateID,
	}
	if newLane.Cards == nil {
		newLane.Cards = []PlannerCard{}
	}

	// Find all lanes with the same template_lane_id to ensure they stay contiguous
	relatedLanes := []PlannerLane{}
	for i := range planner.Lanes {
		if planner.Lanes[i].TemplateLaneID == templateID && planner.Lanes[i].ID != laneID {
			relatedLanes = append(relatedLanes, planner.Lanes[i])
		}
	}

	// Sort related lanes by position
	sort.Slice(relatedLanes, func(i, j int) bool {
		return relatedLanes[i].Position < relatedLanes[j].Position
	})

	// Calculate the insertion position for the new lane
	insertPosition := originalLane.Position + 1

	// Shift all lanes after the insertion position
	for i := range planner.Lanes {
		if planner.Lanes[i].Position >= insertPosition &&
			planner.Lanes[i].ID != laneID &&
			(planner.Lanes[i].TemplateLaneID != templateID || planner.Lanes[i].TemplateLaneID == "") {
			_, err := plannerCollection.UpdateOne(ctx,
				bson.M{"lanes.id": planner.Lanes[i].ID},
				bson.M{"$inc": bson.M{"lanes.$.position": 1}},
			)
			if err != nil {
				return nil, err
			}
		}
	}

	// Update original lane with kept cards and ensure template_lane_id is set
	_, err = plannerCollection.UpdateOne(ctx,
		bson.M{"lanes.id": originalLane.ID},
		bson.M{"$set": bson.M{
			"lanes.$.cards":            cardsToKeep,
			"lanes.$.template_lane_id": templateID,
			"lanes.$.updated_at":       time.Now(),
		}},
	)
	if err != nil {
		return nil, err
	}

	// Insert the new lane
	_, err = plannerCollection.UpdateOne(
		ctx,
		bson.M{"id": planner.ID},
		bson.M{"$push": bson.M{"lanes": newLane}},
	)

	return &newLane, nil
}

// UnsplitLane merges a lane back into a target lane and removes the lane, reindexing cards
func UnsplitLane(ctx context.Context, laneID, targetLaneID string) error {
	log.Printf("UnsplitLane: merging lane %s into lane %s", laneID, targetLaneID)

	var planner Planner
	err := plannerCollection.FindOne(ctx, bson.M{"lanes.id": laneID}).Decode(&planner)
	if err != nil {
		return err
	}

	var source *PlannerLane
	var target *PlannerLane
	for i := range planner.Lanes {
		if planner.Lanes[i].ID == laneID {
			source = &planner.Lanes[i]
		}
		if planner.Lanes[i].ID == targetLaneID {
			target = &planner.Lanes[i]
		}
	}
	if source == nil || target == nil {
		return fmt.Errorf("source or target lane not found")
	}

	// Merge cards and reindex positions
	merged := append([]PlannerCard{}, target.Cards...)

	// Add source cards with updated positions
	for i, card := range source.Cards {
		card.Position = len(target.Cards) + i
		card.LaneID = targetLaneID
		card.UpdatedAt = time.Now()
		merged = append(merged, card)
	}

	// Sort merged cards by position
	sort.Slice(merged, func(i, j int) bool {
		return merged[i].Position < merged[j].Position
	})

	// Update target lane with merged cards
	_, err = plannerCollection.UpdateOne(ctx,
		bson.M{"lanes.id": targetLaneID},
		bson.M{"$set": bson.M{"lanes.$.cards": merged, "lanes.$.updated_at": time.Now()}},
	)
	if err != nil {
		return err
	}

	// Remove source lane
	_, err = plannerCollection.UpdateOne(ctx,
		bson.M{"lanes.id": laneID},
		bson.M{"$pull": bson.M{"lanes": bson.M{"id": laneID}}},
	)
	if err != nil {
		return err
	}

	return nil
}

// HandleUnsplitLane handles PUT /planner/{id}/lane/{laneId}/unsplit
func HandleUnsplitLane(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Extract lane IDs from path
	path := r.URL.Path
	parts := strings.Split(path, "/")
	// /planner/{id}/lane/{laneId}/unsplit?target={targetLaneId}
	if len(parts) != 6 || parts[1] != "planner" || parts[3] != "lane" || parts[5] != "unsplit" {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}
	laneID := parts[4]
	targetLaneID := r.URL.Query().Get("target")
	if targetLaneID == "" {
		http.Error(w, "target lane ID required", http.StatusBadRequest)
		return
	}

	if err := UnsplitLane(r.Context(), laneID, targetLaneID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
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
	plannerID := path[len("/planner/") : len(path)-len("/lane")]

	// Parse request body
	var request struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		Color       string `json:"color"`
		Position    int    `json:"position"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	lane, err := AddLane(r.Context(), plannerID, request.Title, request.Description, request.Color, request.Position)
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
		Color       string `json:"color"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	lane, err := UpdateLane(r.Context(), laneID, request.Title, request.Description, request.Color)
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
		NewColor       string `json:"new_color"`
		SplitPosition  int    `json:"split_position"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}

	lane, err := SplitLane(r.Context(), laneID, request.NewTitle, request.NewDescription, request.NewColor, request.SplitPosition)
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
