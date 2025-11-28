// auth/config.go
package auth

import (
	"os"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
	"strings"
)

// GetOAuthConfig returns the Google OAuth2 configuration
func GetOAuthConfig() *oauth2.Config {
	apiEndpoint := os.Getenv("API_ENDPOINT")
	redirectURL := strings.TrimSuffix(apiEndpoint, "/") + "/auth/google/callback"

	return &oauth2.Config{
		ClientID:     os.Getenv("GOOGLE_CLIENT_ID"),
		ClientSecret: os.Getenv("GOOGLE_CLIENT_SECRET"),
		RedirectURL:  redirectURL,
		Scopes: []string{
			"https://www.googleapis.com/auth/userinfo.email",
			"https://www.googleapis.com/auth/userinfo.profile",
			"openid",
		},
		Endpoint: google.Endpoint,
	}
}

var (
	OAuthConfig = GetOAuthConfig()
	jwtSecret   []byte // Make it unexported
)

func init() {
	ReloadJWTSecret()
}

// ReloadJWTSecret reloads the JWT secret from the environment variable.
// This is useful for testing environments where environment variables might change.
func ReloadJWTSecret() {
	jwtSecret = []byte(os.Getenv("JWT_SECRET"))
}

// GetJWTSecret returns the JWT secret.
func GetJWTSecret() []byte {
	return jwtSecret
}
