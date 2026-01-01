// auth/handlers.go
package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
)

// GoogleUserInfo represents user info returned by Google OAuth
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
	state := uuid.New().String()

	// Use insecure cookies in development (docker, localhost)
	secure := isSecureEnvironment()

	// Debug logging
	apiEndpoint := os.Getenv("API_ENDPOINT")
	uiEndpoint := os.Getenv("UI_ENDPOINT")
	googleClientID := os.Getenv("GOOGLE_CLIENT_ID")

	fmt.Printf("[DEBUG] HandleGoogleLogin called - API_ENDPOINT: %s, UI_ENDPOINT: %s, GOOGLE_CLIENT_ID set: %v, secure cookies: %v\n",
		apiEndpoint, uiEndpoint, googleClientID != "", secure)

	stateCookie := &http.Cookie{
		Name:     "oauth_state",
		Value:    state,
		Path:     "/",
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int(time.Hour.Seconds()),
	}

	// In development, allow cookie to be shared across localhost ports
	if !secure {
		stateCookie.Domain = "localhost"
	}

	http.SetCookie(w, stateCookie)
	url := OAuthConfig.AuthCodeURL(state)
	http.Redirect(w, r, url, http.StatusTemporaryRedirect)
}

// isSecureEnvironment determines if cookies should be secure
// NOTE: INSECURE_COOKIES=true is set in Doppler for development only to allow login over HTTP.
// In production, cookies must use Secure flag (HTTPS only).
func isSecureEnvironment() bool {
	// Check explicit environment variables
	// INSECURE_COOKIES=true is used in dev environment to allow cookies over HTTP (localhost:8080)
	if os.Getenv("INSECURE_COOKIES") == "true" || os.Getenv("ENVIRONMENT") == "development" {
		return false
	}

	// Check if running in Docker (localhost API endpoint)
	apiEndpoint := os.Getenv("API_ENDPOINT")
	if apiEndpoint == "" || apiEndpoint == "http://localhost:8080" || apiEndpoint == "http://backend:8080" {
		return false
	}

	// Default to secure in production
	return true
}

// HandleGoogleCallback handles the Google OAuth callback
func HandleGoogleCallback(w http.ResponseWriter, r *http.Request) {
	fmt.Printf("[DEBUG] HandleGoogleCallback called - URL: %s, Method: %s\n", r.URL.String(), r.Method)
	fmt.Printf("[DEBUG] Request Host: %s, RemoteAddr: %s\n", r.Host, r.RemoteAddr)
	fmt.Printf("[DEBUG] All cookies received: %v\n", r.Cookies())

	stateCookie, err := r.Cookie("oauth_state")
	if err != nil {
		fmt.Printf("[DEBUG] Invalid OAuth state - cookie error: %v, state param: %s\n", err, r.FormValue("state"))
		http.Error(w, "Invalid OAuth state", http.StatusBadRequest)
		return
	}

	if r.FormValue("state") != stateCookie.Value {
		fmt.Printf("[DEBUG] Invalid OAuth state - state param: %s, cookie value: %s\n", r.FormValue("state"), stateCookie.Value)
		http.Error(w, "Invalid OAuth state", http.StatusBadRequest)
		return
	}

	code := r.FormValue("code")
	token, err := OAuthConfig.Exchange(r.Context(), code)
	if err != nil {
		http.Error(w, "Failed to exchange code for token", http.StatusInternalServerError)
		return
	}

	userInfo, err := fetchGoogleUser(r.Context(), token.AccessToken)
	if err != nil {
		http.Error(w, "Failed to get user info", http.StatusInternalServerError)
		return
	}

	user, err := FindUserByGoogleID(r.Context(), userInfo.ID)
	if err != nil {
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
		user.Email = userInfo.Email
		user.Name = userInfo.Name
		user.Picture = userInfo.Picture
		user.LastLoginAt = time.Now()
		if err := UpdateUser(r.Context(), user); err != nil {
			http.Error(w, "Failed to update user", http.StatusInternalServerError)
			return
		}
	}

	jwtToken, err := GenerateToken(user.ID, user.Email)
	if err != nil {
		fmt.Printf("[DEBUG] Failed to generate JWT token: %v\n", err)
		http.Error(w, "Failed to generate token", http.StatusInternalServerError)
		return
	}

	fmt.Printf("[DEBUG] Generated JWT token for user %s (email: %s), token length: %d\n", user.ID, user.Email, len(jwtToken))

	secure := isSecureEnvironment()
	fmt.Printf("[DEBUG] Cookie security settings - Secure: %v, isSecureEnvironment: %v\n", secure, secure)

	// Set auth token cookie
	// SameSite=None requires Secure=true (HTTPS)
	// In development (localhost), use SameSite=Lax with Secure=false
	// In production, use SameSite=None with Secure=true for cross-origin
	var sameSite http.SameSite
	if secure {
		// Production: cross-origin cookies require SameSite=None + Secure
		sameSite = http.SameSiteNoneMode
	} else {
		// Development: localhost allows SameSite=Lax without Secure
		sameSite = http.SameSiteLaxMode
	}

	// In development (localhost), set Domain to allow cookies across ports (8080, 8181, etc)
	// In production, omit Domain to restrict to the current host
	cookie := &http.Cookie{
		Name:     "auth_token",
		Value:    jwtToken,
		Path:     "/",
		HttpOnly: true,
		Secure:   secure,
		SameSite: sameSite,
		MaxAge:   int(24 * time.Hour.Seconds()),
	}

	// In development, allow cookie to be shared across localhost ports
	if !secure {
		cookie.Domain = "localhost"
	}

	fmt.Printf("[DEBUG] Setting auth_token cookie - Name: %s, Domain: %s, Path: %s, Secure: %v, SameSite: %v, MaxAge: %d, HttpOnly: %v\n",
		cookie.Name, cookie.Domain, cookie.Path, cookie.Secure, cookie.SameSite, cookie.MaxAge, cookie.HttpOnly)

	http.SetCookie(w, cookie)

	fmt.Printf("[DEBUG] Cookie set successfully, redirecting to UI\n")

	redirectURL := OAuthConfig.RedirectURL
	if idx := strings.Index(redirectURL, "/auth/callback"); idx != -1 {
		redirectURL = redirectURL[:idx]
	}
	uiEndpoint := os.Getenv("UI_ENDPOINT")
	if uiEndpoint == "" {
		uiEndpoint = "http://localhost:8181"
	}
	finalRedirect := strings.TrimSuffix(uiEndpoint, "/") + "/"
	fmt.Printf("[DEBUG] Redirecting to: %s\n", finalRedirect)
	http.Redirect(w, r, finalRedirect, http.StatusSeeOther)
}

// HandleGetCurrentUser returns the authenticated user
func HandleGetCurrentUser(w http.ResponseWriter, r *http.Request) {
	fmt.Printf("[DEBUG] HandleGetCurrentUser called - URL: %s, Method: %s\n", r.URL.String(), r.Method)
	fmt.Printf("[DEBUG] Request Host: %s, Origin: %s\n", r.Host, r.Header.Get("Origin"))
	fmt.Printf("[DEBUG] All cookies in request: %v\n", r.Cookies())

	userID, ok := r.Context().Value("user_id").(string)
	if !ok {
		fmt.Printf("[DEBUG] No user_id in context - unauthorized\n")
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	fmt.Printf("[DEBUG] Found user_id in context: %s\n", userID)

	user, err := GetUserByID(r.Context(), userID)
	if err != nil {
		fmt.Printf("[DEBUG] Failed to get user by ID %s: %v\n", userID, err)
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	fmt.Printf("[DEBUG] Successfully retrieved user: %s (%s)\n", user.Name, user.Email)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}

// HandleLogout clears the authentication cookie
func HandleLogout(w http.ResponseWriter, r *http.Request) {
	secure := isSecureEnvironment()

	http.SetCookie(w, &http.Cookie{
		Name:     "auth_token",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
	})
	w.WriteHeader(http.StatusNoContent)
}

// fetchGoogleUser retrieves authenticated user info from Google
func fetchGoogleUser(ctx context.Context, accessToken string) (*GoogleUserInfo, error) {
	resp, err := http.Get("https://www.googleapis.com/oauth2/v2/userinfo?access_token=" + accessToken)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	body, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	var userInfo GoogleUserInfo
	if err := json.Unmarshal(body, &userInfo); err != nil {
		return nil, err
	}
	return &userInfo, nil
}
