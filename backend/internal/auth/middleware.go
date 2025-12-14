package auth

import (
	"context"
	"net/http"
	"os"
	"strings"

	"zurabase/internal/httputil"
	"zurabase/internal/services"

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
				httputil.WriteJSONError(w, r, "Unauthorized", http.StatusUnauthorized)
				return
			}
			authHeader = "Bearer " + cookie.Value
		}

		if !strings.HasPrefix(authHeader, "Bearer ") {
			httputil.WriteJSONError(w, r, "Invalid token format", http.StatusUnauthorized)
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
			httputil.WriteJSONError(w, r, "Invalid token", http.StatusUnauthorized)
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
		logger := services.GetLoggerFromGinContext(c, "auth")
		logger.Debug("GinAuthMiddleware called",
			services.String("path", c.Request.URL.Path),
			services.String("method", c.Request.Method),
		)
		logger.Debug("Request details",
			services.String("host", c.Request.Host),
			services.String("origin", c.GetHeader("Origin")),
		)
		logger.Debug("Cookies in request",
			services.Any("cookies", c.Request.Cookies()),
		)

		authHeader := c.GetHeader("Authorization")
		logger.Debug("Authorization header", services.String("header", authHeader))

		if authHeader == "" {
			cookie, err := c.Cookie("auth_token")
			if err != nil {
				logger.Debug("No auth_token cookie found",
					services.Error(err),
					services.Any("available_cookies", c.Request.Cookies()),
				)
				httputil.WriteJSONErrorGin(c, "Unauthorized", http.StatusUnauthorized)
				return
			}
			logger.Debug("Found auth_token cookie",
				services.Int("length", len(cookie)),
				services.String("preview", cookie[:min(20, len(cookie))]),
			)
			authHeader = "Bearer " + cookie
		}

		if !strings.HasPrefix(authHeader, "Bearer ") {
			httputil.WriteJSONErrorGin(c, "Invalid token format", http.StatusUnauthorized)
			return
		}

		tokenStr := strings.TrimPrefix(authHeader, "Bearer ")
		logger.Debug("Validating token", services.Int("token_length", len(tokenStr)))
		
		claims, err := ValidateToken(tokenStr)
		if err != nil {
			logger.Warn("Token validation failed", services.Error(err))
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
			httputil.WriteJSONErrorGin(c, "Invalid token", http.StatusUnauthorized)
			return
		}

		logger.Info("Token validated successfully",
			services.String("user_id", claims.UserID),
			services.String("email", claims.Email),
		)
		
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
