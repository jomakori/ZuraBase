package planner

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"
)

// AddCard adds a new card to a lane
func AddCard(ctx context.Context, laneID, title, content string, position int) (*PlannerCard, error) {
	log.Printf("Adding card: laneID=%s, title=%s, position=%d", laneID, title, position)
	
	cardID := generateID()
	
	_, err := db.ExecContext(ctx, `
		INSERT INTO planner_card (id, lane_id, title, content, position, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`, cardID, laneID, title, content, position)
	if err != nil {
		return nil, err
	}
	
	// Update the positions of other cards
	_, err = db.ExecContext(ctx, `
		UPDATE planner_card
		SET position = position + 1, updated_at = CURRENT_TIMESTAMP
		WHERE lane_id = $1 AND position >= $2 AND id != $3
	`, laneID, position, cardID)
	if err != nil {
		return nil, err
	}
	
	return &PlannerCard{
		ID:        cardID,
		LaneID:    laneID,
		Title:     title,
		Content:   content,
		Position:  position,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}, nil
}

// GetCard retrieves a card by ID
func GetCard(ctx context.Context, cardID string) (*PlannerCard, error) {
	log.Printf("Getting card: id=%s", cardID)
	
	card := &PlannerCard{ID: cardID}
	
	err := db.QueryRowContext(ctx, `
		SELECT lane_id, title, content, position, created_at, updated_at
		FROM planner_card
		WHERE id = $1
	`, cardID).Scan(&card.LaneID, &card.Title, &card.Content, &card.Position, &card.CreatedAt, &card.UpdatedAt)
	if err != nil {
		return nil, err
	}
	
	return card, nil
}

// UpdateCard updates a card's title and content
func UpdateCard(ctx context.Context, cardID, title, content string) (*PlannerCard, error) {
	log.Printf("Updating card: id=%s, title=%s", cardID, title)
	
	_, err := db.ExecContext(ctx, `
		UPDATE planner_card
		SET title = $1, content = $2, updated_at = CURRENT_TIMESTAMP
		WHERE id = $3
	`, title, content, cardID)
	if err != nil {
		return nil, err
	}
	
	return GetCard(ctx, cardID)
}

// DeleteCard deletes a card
func DeleteCard(ctx context.Context, cardID string) error {
	log.Printf("Deleting card: id=%s", cardID)
	
	// Get the lane ID and position of the card
	var laneID string
	var position int
	err := db.QueryRowContext(ctx, `
		SELECT lane_id, position
		FROM planner_card
		WHERE id = $1
	`, cardID).Scan(&laneID, &position)
	if err != nil {
		return err
	}
	
	// Start a transaction
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	
	// Delete the card
	_, err = tx.ExecContext(ctx, `DELETE FROM planner_card WHERE id = $1`, cardID)
	if err != nil {
		return err
	}
	
	// Update the positions of other cards
	_, err = tx.ExecContext(ctx, `
		UPDATE planner_card
		SET position = position - 1, updated_at = CURRENT_TIMESTAMP
		WHERE lane_id = $1 AND position > $2
	`, laneID, position)
	if err != nil {
		return err
	}
	
	// Commit the transaction
	return tx.Commit()
}

// ReorderCards updates the positions of cards in a lane
func ReorderCards(ctx context.Context, laneID string, cardIDs []string) error {
	log.Printf("Reordering cards: laneID=%s, cardCount=%d", laneID, len(cardIDs))
	
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	
	for i, cardID := range cardIDs {
		_, err := tx.ExecContext(ctx, `
			UPDATE planner_card
			SET position = $1, updated_at = CURRENT_TIMESTAMP
			WHERE id = $2 AND lane_id = $3
		`, i+1, cardID, laneID)
		if err != nil {
			return err
		}
	}
	
	return tx.Commit()
}

// MoveCard moves a card to a different lane
func MoveCard(ctx context.Context, cardID, newLaneID string, newPosition int) (*PlannerCard, error) {
	log.Printf("Moving card: id=%s, newLaneID=%s, newPosition=%d", cardID, newLaneID, newPosition)
	
	// Get the current lane ID and position of the card
	var currentLaneID string
	var currentPosition int
	err := db.QueryRowContext(ctx, `
		SELECT lane_id, position
		FROM planner_card
		WHERE id = $1
	`, cardID).Scan(&currentLaneID, &currentPosition)
	if err != nil {
		return nil, err
	}
	
	// Start a transaction
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	
	// Update positions in the source lane
	_, err = tx.ExecContext(ctx, `
		UPDATE planner_card
		SET position = position - 1, updated_at = CURRENT_TIMESTAMP
		WHERE lane_id = $1 AND position > $2
	`, currentLaneID, currentPosition)
	if err != nil {
		return nil, err
	}
	
	// Update positions in the target lane
	_, err = tx.ExecContext(ctx, `
		UPDATE planner_card
		SET position = position + 1, updated_at = CURRENT_TIMESTAMP
		WHERE lane_id = $1 AND position >= $2
	`, newLaneID, newPosition)
	if err != nil {
		return nil, err
	}
	
	// Move the card
	_, err = tx.ExecContext(ctx, `
		UPDATE planner_card
		SET lane_id = $1, position = $2, updated_at = CURRENT_TIMESTAMP
		WHERE id = $3
	`, newLaneID, newPosition, cardID)
	if err != nil {
		return nil, err
	}
	
	// Commit the transaction
	if err := tx.Commit(); err != nil {
		return nil, err
	}
	
	return GetCard(ctx, cardID)
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
	}
	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	
	card, err := MoveCard(r.Context(), cardID, request.NewLaneID, request.NewPosition)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(card); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}
