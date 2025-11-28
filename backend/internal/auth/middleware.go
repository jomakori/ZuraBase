package auth

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

// min returns the minimum of two integers
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// AuthMiddleware enforces authentication on protected routes
func AuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			cookie, err := r.Cookie("auth_token")
			if err != nil {
				http.Error(w, "Unauthorized", http.StatusUnauthorized)
				return
			}
			authHeader = "Bearer " + cookie.Value
		}

		if !strings.HasPrefix(authHeader, "Bearer ") {
			http.Error(w, "Invalid token format", http.StatusUnauthorized)
			return
		}

		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")

		// Try validating as a Google ID token first
		payload, err := VerifyGoogleIDToken(r.Context(), tokenStr, os.Getenv("GOOGLE_CLIENT_ID"))
		if err == nil && payload != nil {
			ctx := context.WithValue(r.Context(), "user_id", payload.Subject)
			if email, ok := payload.Claims["email"].(string); ok {
				ctx = context.WithValue(ctx, "email", email)
			}
			next.ServeHTTP(w, r.WithContext(ctx))
			return
		}

		// Fallback to internal JWT validation
		claims, err := ValidateToken(tokenStr)
		if err != nil {
			http.Error(w, "Invalid token", http.StatusUnauthorized)
			return
		}

		ctx := context.WithValue(r.Context(), "user_id", claims.UserID)
		ctx = context.WithValue(ctx, "email", claims.Email)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// OptionalAuthMiddleware allows requests without token but adds user info if present
func OptionalAuthMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" {
			cookie, err := r.Cookie("auth_token")
			if err == nil {
				authHeader = "Bearer " + cookie.Value
			}
		}

		if !strings.HasPrefix(authHeader, "Bearer ") {
			next.ServeHTTP(w, r)
			return
		}

		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
		claims, err := ValidateToken(tokenStr)
		if err != nil {
			next.ServeHTTP(w, r)
			return
		}

		ctx := context.WithValue(r.Context(), "user_id", claims.UserID)
		ctx = context.WithValue(ctx, "email", claims.Email)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// GinAuthMiddleware enforces authentication on protected routes for Gin
func GinAuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		fmt.Printf("[DEBUG] GinAuthMiddleware called - Path: %s, Method: %s\n", c.Request.URL.Path, c.Request.Method)
		fmt.Printf("[DEBUG] Request Host: %s, Origin: %s\n", c.Request.Host, c.GetHeader("Origin"))
		fmt.Printf("[DEBUG] All cookies in request: %v\n", c.Request.Cookies())

		authHeader := c.GetHeader("Authorization")
		fmt.Printf("[DEBUG] Authorization header: %s\n", authHeader)

		if authHeader == "" {
			cookie, err := c.Cookie("auth_token")
			if err != nil {
				fmt.Printf("[DEBUG] No auth_token cookie found - error: %v\n", err)
				fmt.Printf("[DEBUG] Available cookie names: ")
				for _, c := range c.Request.Cookies() {
					fmt.Printf("%s ", c.Name)
				}
				fmt.Printf("\n")
				c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
				return
			}
			fmt.Printf("[DEBUG] Found auth_token cookie, length: %d, value preview: %s...\n", len(cookie), cookie[:min(20, len(cookie))])
			authHeader = "Bearer " + cookie
		}

		if !strings.HasPrefix(authHeader, "Bearer ") {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid token format"})
			return
		}

		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
		fmt.Printf("[DEBUG] Validating token, length: %d\n", len(tokenStr))
		
		claims, err := ValidateToken(tokenStr)
		if err != nil {
			fmt.Printf("[DEBUG] Token validation failed: %v\n", err)
			// In test mode, allow a static test token to bypass validation
			if os.Getenv("ENVIRONMENT") == "test" && tokenStr == "test-token" {
				c.Set("user_id", "test-user")
				c.Set("email", "test@example.com")
				
				// Also set in request context for logging middleware
				ctx := context.WithValue(c.Request.Context(), "user_id", "test-user")
				ctx = context.WithValue(ctx, "email", "test@example.com")
				c.Request = c.Request.WithContext(ctx)
				
				c.Next()
				return
			}
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			return
		}

		fmt.Printf("[DEBUG] Token validated successfully - UserID: %s, Email: %s\n", claims.UserID, claims.Email)
		
		// Set in Gin context for handlers
		c.Set("user_id", claims.UserID)
		c.Set("email", claims.Email)
		
		// Also set in request context for logging middleware
		ctx := context.WithValue(c.Request.Context(), "user_id", claims.UserID)
		ctx = context.WithValue(ctx, "email", claims.Email)
		c.Request = c.Request.WithContext(ctx)
		
		c.Next()
	}
}

// GinOptionalAuthMiddleware allows requests without token but adds user info if present
func GinOptionalAuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			cookie, err := c.Cookie("auth_token")
			if err == nil {
				authHeader = "Bearer " + cookie
			}
		}

		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			c.Next()
			return
		}

		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
		claims, err := ValidateToken(tokenStr)
		if err != nil {
			c.Next()
			return
		}
	
		// Set in Gin context for handlers
		c.Set("user_id", claims.UserID)
		c.Set("email", claims.Email)
		
		// Also set in request context for logging middleware
		ctx := context.WithValue(c.Request.Context(), "user_id", claims.UserID)
		ctx = context.WithValue(ctx, "email", claims.Email)
		c.Request = c.Request.WithContext(ctx)
		
		c.Next()
	}
}
