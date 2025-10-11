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
	JWTSecret   = []byte(os.Getenv("JWT_SECRET"))
)

