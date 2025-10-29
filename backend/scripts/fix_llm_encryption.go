package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

func main() {
	// Get MongoDB connection string from environment
	mongoURI := os.Getenv("MONGO_URI")
	if mongoURI == "" {
		mongoURI = "mongodb://localhost:27017"
	}

	// Connect to MongoDB
	client, err := mongo.Connect(context.Background(), options.Client().ApplyURI(mongoURI))
	if err != nil {
		log.Fatalf("Failed to connect to MongoDB: %v", err)
	}
	defer client.Disconnect(context.Background())

	// Ping the database
	if err := client.Ping(context.Background(), nil); err != nil {
		log.Fatalf("Failed to ping MongoDB: %v", err)
	}

	// Get the database and collection
	db := client.Database("zurabase")
	collection := db.Collection("llm_profiles")

	// Create a timeout context
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// Find all LLM profiles
	cursor, err := collection.Find(ctx, bson.M{})
	if err != nil {
		log.Fatalf("Failed to find LLM profiles: %v", err)
	}
	defer cursor.Close(ctx)

	var profiles []bson.M
	if err := cursor.All(ctx, &profiles); err != nil {
		log.Fatalf("Failed to decode LLM profiles: %v", err)
	}

	fmt.Printf("Found %d LLM profiles\n", len(profiles))

	// Reset the API keys (set them to empty strings since they can't be decrypted)
	for _, profile := range profiles {
		id := profile["id"].(string)
		fmt.Printf("Resetting API key for profile: %s\n", id)

		// Update the profile to clear the encrypted API key
		_, err := collection.UpdateOne(
			ctx,
			bson.M{"id": id},
			bson.M{"$set": bson.M{
				"api_key_encrypted": "",
				"updated_at":        time.Now(),
			}},
		)
		if err != nil {
			log.Printf("Failed to reset API key for profile %s: %v", id, err)
		} else {
			fmt.Printf("Successfully reset API key for profile: %s\n", id)
		}
	}

	fmt.Println("LLM profile encryption fix completed!")
	fmt.Println("Users will need to re-enter their API keys for their LLM profiles.")
}
