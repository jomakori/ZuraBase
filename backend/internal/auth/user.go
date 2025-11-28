// auth/user.go
package auth

import (
	"context"
	"time"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo"
)

type User struct {
	ID          string    `json:"id" bson:"id"`
	Email       string    `json:"email" bson:"email"`
	Name        string    `json:"name" bson:"name"`
	Picture     string    `json:"picture" bson:"picture"`
	GoogleID    string    `json:"google_id" bson:"google_id"`
	LastLoginAt time.Time `json:"last_login_at" bson:"last_login_at"`
	CreatedAt   time.Time `json:"created_at" bson:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" bson:"updated_at"`
}

var userCollection *mongo.Collection

func Initialize(client *mongo.Client, dbName string) {
	userCollection = client.Database(dbName).Collection("users")
}

func FindUserByGoogleID(ctx context.Context, googleID string) (*User, error) {
	var user User
	err := userCollection.FindOne(ctx, bson.M{"google_id": googleID}).Decode(&user)
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func CreateUser(ctx context.Context, user *User) error {
	now := time.Now()
	user.CreatedAt = now
	user.UpdatedAt = now
	user.LastLoginAt = now

	_, err := userCollection.InsertOne(ctx, user)
	return err
}

func UpdateUser(ctx context.Context, user *User) error {
	user.UpdatedAt = time.Now()
	filter := bson.M{"id": user.ID}
	update := bson.M{"$set": user}
	_, err := userCollection.UpdateOne(ctx, filter, update)
	return err
}

func UpdateLoginTime(ctx context.Context, userID string) error {
	filter := bson.M{"id": userID}
	update := bson.M{"$set": bson.M{"last_login_at": time.Now()}}
	_, err := userCollection.UpdateOne(ctx, filter, update)
	return err
}

func GetUserByID(ctx context.Context, id string) (*User, error) {
	var user User
	err := userCollection.FindOne(ctx, bson.M{"id": id}).Decode(&user)
	if err != nil {
		return nil, err
	}
	return &user, nil
}
