# Backend Authentication Implementation

This document outlines the detailed implementation plan for adding Google OAuth authentication to the ZuraBase backend.

## 1. Dependencies

We'll need to add the following Go packages:

```go
import (
    "golang.org/x/oauth2"
    "golang.org/x/oauth2/google"
    "github.com/golang-jwt/jwt/v4"
    "github.com/gorilla/sessions"
)
```

## 2. Configuration

Add OAuth configuration to the backend:

```go
// auth/config.go
package auth

import (
    "os"
    "golang.org/x/oauth2"
    "golang.org/x/oauth2/google"
)

var (
    // OAuth configuration
    OAuthConfig = &oauth2.Config{
        ClientID:     os.Getenv("GOOGLE_CLIENT_ID"),
        ClientSecret: os.Getenv("GOOGLE_CLIENT_SECRET"),
        RedirectURL:  os.Getenv("OAUTH_REDIRECT_URL"),
        Scopes: []string{
            "https://www.googleapis.com/auth/userinfo.email",
            "https://www.googleapis.com/auth/userinfo.profile",
            "openid",
        },
        Endpoint: google.Endpoint,
    }

    // JWT configuration
    JWTSecret = []byte(os.Getenv("JWT_SECRET"))
)
```

## 3. User Model and Database Functions

Create a user model and database functions:

```go
// auth/user.go
package auth

import (
    "context"
    "time"
    "go.mongodb.org/mongo-driver/bson"
    "go.mongodb.org/mongo-driver/mongo"
)

// User represents a user in the system
type User struct {
    ID            string    `json:"id" bson:"id"`
    Email         string    `json:"email" bson:"email"`
    Name          string    `json:"name" bson:"name"`
    Picture       string    `json:"picture" bson:"picture"`
    GoogleID      string    `json:"google_id" bson:"google_id"`
    LastLoginAt   time.Time `json:"last_login_at" bson:"last_login_at"`
    CreatedAt     time.Time `json:"created_at" bson:"created_at"`
    UpdatedAt     time.Time `json:"updated_at" bson:"updated_at"`
}

var userCollection *mongo.Collection

// Initialize sets up the MongoDB collection for users
func Initialize(client *mongo.Client, dbName string) {
    userCollection = client.Database(dbName).Collection("users")
}

// FindUserByGoogleID finds a user by their Google ID
func FindUserByGoogleID(ctx context.Context, googleID string) (*User, error) {
    var user User
    err := userCollection.FindOne(ctx, bson.M{"google_id": googleID}).Decode(&user)
    if err != nil {
        return nil, err
    }
    return &user, nil
}

// CreateUser creates a new user in the database
func CreateUser(ctx context.Context, user *User) error {
    now := time.Now()
    user.CreatedAt = now
    user.UpdatedAt = now
    user.LastLoginAt = now
    
    _, err := userCollection.InsertOne(ctx, user)
    return err
}

// UpdateUser updates an existing user in the database
func UpdateUser(ctx context.Context, user *User) error {
    user.UpdatedAt = time.Now()
    
    filter := bson.M{"id": user.ID}
    update := bson.M{"$set": user}
    
    _, err := userCollection.UpdateOne(ctx, filter, update)
    return err
}

// UpdateLoginTime updates the last login time for a user
func UpdateLoginTime(ctx context.Context, userID string) error {
    filter := bson.M{"id": userID}
    update := bson.M{"$set": bson.M{"last_login_at": time.Now()}}
    
    _, err := userCollection.UpdateOne(ctx, filter, update)
    return err
}

// GetUserByID retrieves a user by their ID
func GetUserByID(ctx context.Context, id string) (*User, error) {
    var user User
    err := userCollection.FindOne(ctx, bson.M{"id": id}).Decode(&user)
    if err != nil {
        return nil, err
    }
    return &user, nil
}
```

## 4. JWT Token Management

Implement JWT token generation and validation:

```go
// auth/jwt.go
package auth

import (
    "errors"
    "time"
    "github.com/golang-jwt/jwt/v4"
)

// Claims represents the JWT claims
type Claims struct {
    UserID string `json:"user_id"`
    Email  string `json:"email"`
    jwt.RegisteredClaims
}

// GenerateToken generates a JWT token for a user
func GenerateToken(userID, email string) (string, error) {
    // Create claims with expiration time
    claims := &Claims{
        UserID: userID,
        Email:  email,
        RegisteredClaims: jwt.RegisteredClaims{
            ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
            IssuedAt:  jwt.NewNumericDate(time.Now()),
            NotBefore: jwt.NewNumericDate(time.Now()),
            Issuer:    "zurabase",
        },
    }
    
    // Create token with claims
    token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
    
    // Sign token with secret
    tokenString, err := token.SignedString(JWTSecret)
    if err != nil {
        return "", err
    }
    
    return tokenString, nil
}

// ValidateToken validates a JWT token and returns the claims
func ValidateToken(tokenString string) (*Claims, error) {
    // Parse token
    token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
        return JWTSecret, nil
    })
    
    if err != nil {
        return nil, err
    }
    
    // Validate token
    if !token.Valid {
        return nil, errors.New("invalid token")
    }
    
    // Get claims
    claims, ok := token.Claims.(*Claims)
    if !ok {
        return nil, errors.New("invalid claims")
    }
    
    return claims, nil
}
```

## 5. Authentication Middleware

Create middleware for protected routes:

```go
// auth/middleware.go
package auth

import (
    "context"
    "net/http"
    "strings"
)

// AuthMiddleware is middleware for authenticating requests
func AuthMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // Get token from Authorization header
        authHeader := r.Header.Get("Authorization")
        if authHeader == "" {
            // Check for token in cookie
            cookie, err := r.Cookie("auth_token")
            if err != nil {
                http.Error(w, "Unauthorized", http.StatusUnauthorized)
                return
            }
            authHeader = "Bearer " + cookie.Value
        }
        
        // Check if token is in correct format
        if !strings.HasPrefix(authHeader, "Bearer ") {
            http.Error(w, "Invalid token format", http.StatusUnauthorized)
            return
        }
        
        // Extract token
        tokenString := strings.TrimPrefix(authHeader, "Bearer ")
        
        // Validate token
        claims, err := ValidateToken(tokenString)
        if err != nil {
            http.Error(w, "Invalid token", http.StatusUnauthorized)
            return
        }
        
        // Add user ID to request context
        ctx := context.WithValue(r.Context(), "user_id", claims.UserID)
        ctx = context.WithValue(ctx, "email", claims.Email)
        
        // Call next handler with updated context
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}

// OptionalAuthMiddleware is middleware that adds user info to context if available
// but doesn't require authentication
func OptionalAuthMiddleware(next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // Get token from Authorization header
        authHeader := r.Header.Get("Authorization")
        if authHeader == "" {
            // Check for token in cookie
            cookie, err := r.Cookie("auth_token")
            if err == nil {
                authHeader = "Bearer " + cookie.Value
            }
        }
        
        // If no token, continue without user info
        if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
            next.ServeHTTP(w, r)
            return
        }
        
        // Extract token
        tokenString := strings.TrimPrefix(authHeader, "Bearer ")
        
        // Validate token
        claims, err := ValidateToken(tokenString)
        if err != nil {
            // Continue without user info
            next.ServeHTTP(w, r)
            return
        }
        
        // Add user ID to request context
        ctx := context.WithValue(r.Context(), "user_id", claims.UserID)
        ctx = context.WithValue(ctx, "email", claims.Email)
        
        // Call next handler with updated context
        next.ServeHTTP(w, r.WithContext(ctx))
    })
}
```

## 6. Authentication Handlers

Implement handlers for authentication endpoints:

```go
// auth/handlers.go
package auth

import (
    "context"
    "encoding/json"
    "fmt"
    "io/ioutil"
    "log"
    "net/http"
    "time"
    
    "github.com/google/uuid"
)

// GoogleUserInfo represents the user info returned by Google
type GoogleUserInfo struct {
    ID            string `json:"id"`
    Email         string `json:"email"`
    VerifiedEmail bool   `json:"verified_email"`
    Name          string `json:"name"`
    GivenName     string `json:"given_name"`
    FamilyName    string `json:"family_name"`
    Picture       string `json:"picture"`
    Locale        string `json:"locale"`
}

// HandleGoogleLogin initiates the Google OAuth flow
func HandleGoogleLogin(w http.ResponseWriter, r *http.Request) {
    // Generate random state
    state := uuid.New().String()
    
    // Store state in cookie
    http.SetCookie(w, &http.Cookie{
        Name:     "oauth_state",
        Value:    state,
        Path:     "/",
        HttpOnly: true,
        Secure:   true,
        SameSite: http.SameSiteLaxMode,
        MaxAge:   int(time.Hour.Seconds()),
    })
    
    // Redirect to Google OAuth URL
    url := OAuthConfig.AuthCodeURL(state)
    http.Redirect(w, r, url, http.StatusTemporaryRedirect)
}

// HandleGoogleCallback handles the Google OAuth callback
func HandleGoogleCallback(w http.ResponseWriter, r *http.Request) {
    // Get state from cookie
    stateCookie, err := r.Cookie("oauth_state")
    if err != nil {
        http.Error(w, "State not found", http.StatusBadRequest)
        return
    }
    
    // Verify state
    if r.FormValue("state") != stateCookie.Value {
        http.Error(w, "State mismatch", http.StatusBadRequest)
        return
    }
    
    // Exchange code for token
    code := r.FormValue("code")
    token, err := OAuthConfig.Exchange(r.Context(), code)
    if err != nil {
        http.Error(w, "Failed to exchange code for token", http.StatusInternalServerError)
        return
    }
    
    // Get user info from Google
    userInfo, err := getUserInfoFromGoogle(r.Context(), token.AccessToken)
    if err != nil {
        http.Error(w, "Failed to get user info", http.StatusInternalServerError)
        return
    }
    
    // Find or create user
    user, err := FindUserByGoogleID(r.Context(), userInfo.ID)
    if err != nil {
        // Create new user
        user = &User{
            ID:       uuid.New().String(),
            Email:    userInfo.Email,
            Name:     userInfo.Name,
            Picture:  userInfo.Picture,
            GoogleID: userInfo.ID,
        }
        
        if err := CreateUser(r.Context(), user); err != nil {
            http.Error(w, "Failed to create user", http.StatusInternalServerError)
            return
        }
    } else {
        // Update existing user
        user.Email = userInfo.Email
        user.Name = userInfo.Name
        user.Picture = userInfo.Picture
        user.LastLoginAt = time.Now()
        
        if err := UpdateUser(r.Context(), user); err != nil {
            http.Error(w, "Failed to update user", http.StatusInternalServerError)
            return
        }
    }
    
    // Generate JWT token
    jwtToken, err := GenerateToken(user.ID, user.Email)
    if err != nil {
        http.Error(w, "Failed to generate token", http.StatusInternalServerError)
        return
    }
    
    // Set token in cookie
    http.SetCookie(w, &http.Cookie{
        Name:     "auth_token",
        Value:    jwtToken,
        Path:     "/",
        HttpOnly: true,
        Secure:   true,
        SameSite: http.SameSiteLaxMode,
        MaxAge:   int(24 * time.Hour.Seconds()),
    })
    
    // Redirect to frontend
    frontendURL := OAuthConfig.RedirectURL
    if idx := strings.Index(frontendURL, "/auth/callback"); idx != -1 {
        frontendURL = frontendURL[:idx]
    }
    http.Redirect(w, r, frontendURL+"/dashboard", http.StatusTemporaryRedirect)
}

// HandleGetCurrentUser returns the current user info
func HandleGetCurrentUser(w http.ResponseWriter, r *http.Request) {
    // Get user ID from context
    userID, ok := r.Context().Value("user_id").(string)
    if !ok {
        http.Error(w, "Unauthorized", http.StatusUnauthorized)
        return
    }
    
    // Get user from database
    user, err := GetUserByID(r.Context(), userID)
    if err != nil {
        http.Error(w, "User not found", http.StatusNotFound)
        return
    }
    
    // Return user info
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(user)
}

// HandleLogout logs out the user
func HandleLogout(w http.ResponseWriter, r *http.Request) {
    // Clear auth cookie
    http.SetCookie(w, &http.Cookie{
        Name:     "auth_token",
        Value:    "",
        Path:     "/",
        HttpOnly: true,
        Secure:   true,
        SameSite: http.SameSiteLaxMode,
        MaxAge:   -1,
    })
    
    w.WriteHeader(http.StatusNoContent)
}

// getUserInfoFromGoogle gets user info from Google API
func getUserInfoFromGoogle(ctx context.Context, accessToken string) (*GoogleUserInfo, error) {
    // Make request to Google API
    resp, err := http.Get("https://www.googleapis.com/oauth2/v2/userinfo?access_token=" + accessToken)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    
    // Read response body
    body, err := ioutil.ReadAll(resp.Body)
    if err != nil {
        return nil, err
    }
    
    // Parse response
    var userInfo GoogleUserInfo
    if err := json.Unmarshal(body, &userInfo); err != nil {
        return nil, err
    }
    
    return &userInfo, nil
}
```

## 7. Update Main.go

Update the main.go file to include the new authentication endpoints:

```go
// Add to imports
import (
    "zurabase/auth"
)

// Add to main() function
func main() {
    // ... existing code ...
    
    // Initialize auth package
    auth.Initialize(mongoClient, "zurabase")
    
    // ... existing code ...
    
    // Register auth routes
    mux.HandleFunc("/auth/google", auth.HandleGoogleLogin)
    mux.HandleFunc("/auth/google/callback", auth.HandleGoogleCallback)
    mux.HandleFunc("/auth/user", func(w http.ResponseWriter, r *http.Request) {
        auth.AuthMiddleware(http.HandlerFunc(auth.HandleGetCurrentUser)).ServeHTTP(w, r)
    })
    mux.HandleFunc("/auth/logout", auth.HandleLogout)
    
    // Add auth middleware to existing routes
    protectedMux := auth.OptionalAuthMiddleware(mux)
    
    // ... existing code ...
    
    // Update handler to use protectedMux
    handler := CORS(protectedMux)
    
    // ... existing code ...
}
```

## 8. Update Note and Planner Handlers

Update the note and planner handlers to associate content with users:

```go
// notes/handlers.go

// Update HandleSaveNote
func HandleSaveNote(w http.ResponseWriter, r *http.Request) {
    // ... existing code ...
    
    // Get user ID from context if available
    userID, _ := r.Context().Value("user_id").(string)
    
    // Decode note from request body
    var note Note
    if err := json.NewDecoder(r.Body).Decode(&note); err != nil {
        http.Error(w, err.Error(), http.StatusBadRequest)
        return
    }
    
    // Set user ID if available
    if userID != "" {
        note.UserID = userID
    }
    
    // ... existing code ...
}

// Add new handler for getting user's notes
func HandleGetUserNotes(w http.ResponseWriter, r *http.Request) {
    // Get user ID from context
    userID, ok := r.Context().Value("user_id").(string)
    if !ok {
        http.Error(w, "Unauthorized", http.StatusUnauthorized)
        return
    }
    
    // Get notes from database
    notes, err := GetNotesByUserID(r.Context(), userID)
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }
    
    // Return notes
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(notes)
}

// Add new function to get notes by user ID
func GetNotesByUserID(ctx context.Context, userID string) ([]Note, error) {
    cursor, err := noteCollection.Find(ctx, bson.M{"user_id": userID})
    if err != nil {
        return nil, err
    }
    defer cursor.Close(ctx)
    
    var notes []Note
    if err := cursor.All(ctx, &notes); err != nil {
        return nil, err
    }
    
    return notes, nil
}

// Add new handler for importing a note
func HandleImportNote(w http.ResponseWriter, r *http.Request) {
    // Get user ID from context
    userID, ok := r.Context().Value("user_id").(string)
    if !ok {
        http.Error(w, "Unauthorized", http.StatusUnauthorized)
        return
    }
    
    // Get note ID from URL
    path := r.URL.Path
    noteID := path[len("/note/import/"):]
    
    // Get original note
    originalNote, err := GetNote(r.Context(), noteID)
    if err != nil {
        http.Error(w, err.Error(), http.StatusNotFound)
        return
    }
    
    // Create new note with user ID
    newNote := *originalNote
    newNote.ID = generateID()
    newNote.UserID = userID
    newNote.CreatedAt = time.Now()
    newNote.UpdatedAt = time.Now()
    
    // Save new note
    savedNote, err := SaveNote(r.Context(), &newNote)
    if err != nil {
        http.Error(w, err.Error(), http.StatusInternalServerError)
        return
    }
    
    // Return new note
    w.Header().Set("Content-Type", "application/json")
    json.NewEncoder(w).Encode(savedNote)
}
```

Similar updates would be made to the planner handlers.

## 9. Environment Variables

Add the following environment variables to the application:

```
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
JWT_SECRET=your-jwt-secret
```

## 10. Testing

Test the authentication flow:

1. Start the application with the new environment variables
2. Navigate to `/auth/google` to initiate the OAuth flow
3. Complete the Google authentication
4. Verify that you are redirected to the dashboard
5. Test protected endpoints with and without authentication
6. Test the import functionality
