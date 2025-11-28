package models

import (
	"context"
	"log"
	"time"

	"go.mongodb.org/mongo-driver/mongo/options"
)

// WhatsAppUserMap defines a mapping between a WhatsApp number and an authenticated ZuraBase user
type WhatsAppUserMap struct {
	WhatsAppNumber string    `bson:"whatsapp_number" json:"whatsapp_number"`
	UserID         string    `bson:"user_id" json:"user_id"`
	LinkedAt       time.Time `bson:"linked_at" json:"linked_at"`
}

// LinkWhatsAppUser creates or updates a mapping between a WhatsApp sender and a ZuraBase user
func LinkWhatsAppUser(ctx context.Context, number, userID string) error {
	if strandCollection == nil {
		log.Fatal("whatsapp_user_map attempted before Mongo initialized")
	}
	db := strandCollection.Database()
	collection := db.Collection("whatsapp_user_map")
	_, err := collection.UpdateOne(ctx,
		map[string]string{"whatsapp_number": number},
		map[string]interface{}{"$set": WhatsAppUserMap{
			WhatsAppNumber: number,
			UserID:         userID,
			LinkedAt:       time.Now(),
		}},
		options.Update().SetUpsert(true),
	)
	return err
}

// GetUserByWhatsAppNumber retrieves the associated ZuraBase user ID from a WhatsApp number
func GetUserByWhatsAppNumber(ctx context.Context, number string) (string, error) {
	if strandCollection == nil {
		log.Fatal("whatsapp_user_map attempted before Mongo initialized")
	}
	db := strandCollection.Database()
	collection := db.Collection("whatsapp_user_map")
	var record WhatsAppUserMap
	err := collection.FindOne(ctx, map[string]string{"whatsapp_number": number}).Decode(&record)
	if err != nil {
		return "", err
	}
	return record.UserID, nil
}
