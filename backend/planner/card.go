package planner

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// AddCard adds a new card to a lane in MongoDB
func AddCard(ctx context.Context, laneID, title, content string, position int) (*PlannerCard, error) {
	log.Printf("Adding card: laneID=%s, title=%s, position=%d", laneID, title, position)

	cardID := generateID()
	card := PlannerCard{
		ID:        cardID,
		LaneID:    laneID,
		Fields: map[string]interface{}{
			"title":   title,
			"content": content,
		},
		Position:  position,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// push card into lane document
	_, err := plannerCollection.UpdateOne(
		ctx,
		bson.M{"lanes.id": laneID},
		bson.M{"$push": bson.M{"lanes.$.cards": card}},
	)
	if err != nil {
		return nil, err
	}
	return &card, nil
}

 // GetCard retrieves a card by ID from MongoDB
func GetCard(ctx context.Context, cardID string) (*PlannerCard, error) {
	log.Printf("Getting card: id=%s", cardID)

	var result PlannerCard
	err := plannerCollection.FindOne(ctx, bson.M{"lanes.cards.id": cardID}).Decode(&result)
	if err != nil {
		return nil, err
	}
	return &result, nil
}

 // UpdateCard updates a card's title and content in MongoDB
func UpdateCard(ctx context.Context, cardID, title, content string) (*PlannerCard, error) {
	log.Printf("Updating card: id=%s, title=%s", cardID, title)

	filter := bson.M{"lanes.cards.id": cardID}
	update := bson.M{"$set": bson.M{
		"lanes.$[].cards.$[elem].fields.title":   title,
		"lanes.$[].cards.$[elem].fields.content": content,
		"lanes.$[].cards.$[elem].updated_at":     time.Now(),
	}}
	arrayFilters := options.Update().SetArrayFilters(options.ArrayFilters{
		Filters: []interface{}{bson.M{"elem.id": cardID}},
	})

	_, err := plannerCollection.UpdateOne(ctx, filter, update, arrayFilters)
	if err != nil {
		return nil, err
	}

	// Re-fetch card to return
	updated, err := GetCard(ctx, cardID)
	if err != nil {
		return nil, err
	}
	// Ensure updated fields include latest title/content
	if updated.Fields == nil {
		updated.Fields = map[string]interface{}{}
	}
	updated.Fields["title"] = title
	updated.Fields["content"] = content
	return updated, nil
}

 // DeleteCard removes a card from a lane in MongoDB
func DeleteCard(ctx context.Context, cardID string) error {
	log.Printf("Deleting card: id=%s", cardID)

	_, err := plannerCollection.UpdateOne(
		ctx,
		bson.M{"lanes.cards.id": cardID},
		bson.M{"$pull": bson.M{"lanes.$[].cards": bson.M{"id": cardID}}},
	)
	return err
}

 // ReorderCards updates the positions of cards inside a lane in MongoDB
func ReorderCards(ctx context.Context, laneID string, cardIDs []string) error {
	log.Printf("Reordering cards: laneID=%s, cardCount=%d", laneID, len(cardIDs))

	for i, cardID := range cardIDs {
		filter := bson.M{"lanes.id": laneID, "lanes.cards.id": cardID}
		update := bson.M{"$set": bson.M{"lanes.$[].cards.$[elem].position": i + 1}}
		arrayFilters := options.Update().SetArrayFilters(options.ArrayFilters{
			Filters: []interface{}{bson.M{"elem.id": cardID}},
		})
		_, err := plannerCollection.UpdateOne(ctx, filter, update, arrayFilters)
		if err != nil {
			return err
		}
	}
	return nil
}

 // MoveCard moves a card to a different lane in MongoDB
func MoveCard(ctx context.Context, cardID, newLaneID string, newPosition int) (*PlannerCard, error) {
	log.Printf("Moving card: id=%s, newLaneID=%s, newPosition=%d", cardID, newLaneID, newPosition)

	// Pull card from current lane
	var card PlannerCard
	err := plannerCollection.FindOneAndUpdate(
		ctx,
		bson.M{"lanes.cards.id": cardID},
		bson.M{"$pull": bson.M{"lanes.$[].cards": bson.M{"id": cardID}}},
	).Decode(&card)
	if err != nil {
		return nil, err
	}

	// Push card into new lane
	card.LaneID = newLaneID
	card.Position = newPosition
	if card.Fields == nil {
		card.Fields = map[string]interface{}{}
	}
	card.Fields["lane_id"] = newLaneID
	card.UpdatedAt = time.Now()

	_, err = plannerCollection.UpdateOne(
		ctx,
		bson.M{"lanes.id": newLaneID},
		bson.M{"$push": bson.M{"lanes.$.cards": card}},
	)
	if err != nil {
		return nil, err
	}
	// Ensure fields map is initialized
	if card.Fields == nil {
		card.Fields = map[string]interface{}{}
	}
	card.Fields["lane_id"] = newLaneID
	card.Fields["moved_at"] = time.Now().Format(time.RFC3339)

	return &card, nil
}

// HandleAddCard handles POST /planner/{id}/lane/{laneId}/card
func HandleAddCard(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	// Extract lane ID from path
	path := r.URL.Path
	parts := strings.Split(path, "/")
	if len(parts) != 6 || parts[1] != "planner" || parts[3] != "lane" || parts[5] != "card" {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}
	laneID := parts[4]
	
	// Parse request body
	var request struct {
		Title    string `json:"title"`
		Content  string `json:"content"`
		Position int    `json:"position"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	
	card, err := AddCard(r.Context(), laneID, request.Title, request.Content, request.Position)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(card); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

// HandleGetCard handles GET /planner/{id}/lane/{laneId}/card/{cardId}
func HandleGetCard(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	// Extract card ID from path
	path := r.URL.Path
	parts := strings.Split(path, "/")
	if len(parts) != 7 || parts[1] != "planner" || parts[3] != "lane" || parts[5] != "card" {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}
	cardID := parts[6]
	
	card, err := GetCard(r.Context(), cardID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusNotFound)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(card); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

// HandleUpdateCard handles PUT /planner/{id}/lane/{laneId}/card/{cardId}
func HandleUpdateCard(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	// Extract card ID from path
	path := r.URL.Path
	parts := strings.Split(path, "/")
	if len(parts) != 7 || parts[1] != "planner" || parts[3] != "lane" || parts[5] != "card" {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}
	cardID := parts[6]
	
	// Parse request body
	var request struct {
		Title   string `json:"title"`
		Content string `json:"content"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	// Wrap into fields
	if request.Title == "" && request.Content == "" {
		http.Error(w, "No fields provided", http.StatusBadRequest)
		return
	}
	
	card, err := UpdateCard(r.Context(), cardID, request.Title, request.Content)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(card); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

// HandleDeleteCard handles DELETE /planner/{id}/lane/{laneId}/card/{cardId}
func HandleDeleteCard(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	// Extract card ID from path
	path := r.URL.Path
	parts := strings.Split(path, "/")
	if len(parts) != 7 || parts[1] != "planner" || parts[3] != "lane" || parts[5] != "card" {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}
	cardID := parts[6]
	
	if err := DeleteCard(r.Context(), cardID); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	
	w.WriteHeader(http.StatusNoContent)
}

// HandleReorderCards handles PUT /planner/{id}/lane/{laneId}/cards/reorder
func HandleReorderCards(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	// Extract lane ID from path
	path := r.URL.Path
	parts := strings.Split(path, "/")
	if len(parts) != 7 || parts[1] != "planner" || parts[3] != "lane" || parts[5] != "cards" || parts[6] != "reorder" {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}
	laneID := parts[4]
	
	// Parse request body
	var request struct {
		CardIDs []string `json:"card_ids"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	
	if err := ReorderCards(r.Context(), laneID, request.CardIDs); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	
	w.WriteHeader(http.StatusNoContent)
}

// HandleMoveCard handles PUT /planner/{id}/card/{cardId}/move
func HandleMoveCard(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	
	// Extract card ID from path
	path := r.URL.Path
	parts := strings.Split(path, "/")
	if len(parts) != 6 || parts[1] != "planner" || parts[3] != "card" || parts[5] != "move" {
		http.Error(w, "Invalid path", http.StatusBadRequest)
		return
	}
	cardID := parts[4]
	
	// Parse request body
	var request struct {
		NewLaneID   string `json:"new_lane_id"`
		NewPosition int    `json:"new_position"`
		Fields      map[string]interface{} `json:"fields,omitempty"`
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	
	card, err := MoveCard(r.Context(), cardID, request.NewLaneID, request.NewPosition)
	if err == nil && request.Fields != nil {
		if card.Fields == nil {
			card.Fields = map[string]interface{}{}
		}
		for k, v := range request.Fields {
			card.Fields[k] = v
		}
	}
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(card); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}
