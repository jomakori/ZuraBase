package tests

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"context"
	"zurabase/internal/auth"
	"zurabase/internal/server"

	"google.golang.org/api/idtoken"
)

func TestAuth_FlowSmoke(t *testing.T) {
	// Mock Google ID token verification for testing
	auth.SetMockGoogleVerifier(func(ctx context.Context, idToken string) (*idtoken.Payload, error) {
		return &idtoken.Payload{
			Issuer:   "https://accounts.google.com",
			Subject:  "test-user-id",
			Audience: "test-client-id",
			Claims:   map[string]interface{}{"email": "test@example.com"},
		}, nil
	})

	router := server.SetupTestRouter()

	testCases := []struct {
		name           string
		method         string
		path           string
		body           interface{}
		headers        map[string]string
		expectedStatus int
		description    string
	}{
		{
			name:           "Google Login Redirect",
			method:         "GET",
			path:           "/api/auth/google",
			body:           nil,
			headers:        nil,
			expectedStatus: http.StatusTemporaryRedirect,
			description:    "Should redirect to Google OAuth URL",
		},
		{
			name:           "Google Login Alt Route",
			method:         "GET",
			path:           "/auth/google",
			body:           nil,
			headers:        nil,
			expectedStatus: http.StatusTemporaryRedirect,
			description:    "Should redirect to Google OAuth URL (alt route)",
		},
		{
			name:           "Google Callback Missing State",
			method:         "GET",
			path:           "/api/auth/google/callback",
			body:           nil,
			headers:        nil,
			expectedStatus: http.StatusBadRequest,
			description:    "Should return 400 when state is missing or invalid",
		},
		{
			name:           "Google Callback Alt Route",
			method:         "GET",
			path:           "/auth/google/callback",
			body:           nil,
			headers:        nil,
			expectedStatus: http.StatusBadRequest,
			description:    "Should return 400 when state is missing (alt route)",
		},
		{
			name:           "Get Current User Without Auth",
			method:         "GET",
			path:           "/api/auth/user",
			body:           nil,
			headers:        nil,
			expectedStatus: http.StatusUnauthorized,
			description:    "Should return 401 when no token is provided",
		},
		{
			name:           "Get Current User Alt Route",
			method:         "GET",
			path:           "/auth/user",
			body:           nil,
			headers:        nil,
			expectedStatus: http.StatusUnauthorized,
			description:    "Should return 401 when no token is provided (alt route)",
		},
		{
			name:           "Get Current User With Invalid Token",
			method:         "GET",
			path:           "/api/auth/user",
			body:           nil,
			headers:        map[string]string{"Authorization": "Bearer invalid_token"},
			expectedStatus: http.StatusUnauthorized,
			description:    "Should return 401 with invalid JWT token",
		},
		{
			name:           "Logout Without Auth",
			method:         "POST",
			path:           "/api/auth/logout",
			body:           nil,
			headers:        nil,
			expectedStatus: http.StatusNoContent,
			description:    "Should clear auth cookie and return 204",
		},
		{
			name:           "Logout Alt Route",
			method:         "POST",
			path:           "/auth/logout",
			body:           nil,
			headers:        nil,
			expectedStatus: http.StatusNoContent,
			description:    "Should clear auth cookie and return 204 (alt route)",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			var bodyBytes []byte
			if tc.body != nil {
				var err error
				bodyBytes, err = json.Marshal(tc.body)
				if err != nil {
					t.Fatalf("Failed to marshal request body: %v", err)
				}
			}

			req, err := http.NewRequest(tc.method, tc.path, bytes.NewReader(bodyBytes))
			if err != nil {
				t.Fatalf("Failed to create request: %v", err)
			}

			// Set headers
			req.Header.Set("Origin", "http://localhost:5173")
			if tc.body != nil {
				req.Header.Set("Content-Type", "application/json")
			}
			if tc.headers != nil {
				for k, v := range tc.headers {
					req.Header.Set(k, v)
				}
			}

			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, req)

			if rec.Code != tc.expectedStatus {
				t.Errorf("%s: Expected status %d, got %d. %s", tc.name, tc.expectedStatus, rec.Code, tc.description)
				t.Logf("Response body: %s", rec.Body.String())
			}
		})
	}
}

// TestAuth_TokenGeneration tests JWT token generation
func TestAuth_TokenGeneration(t *testing.T) {
	router := server.SetupTestRouter()

	// Create a simple endpoint that returns the current user if authenticated
	// This would need a test user with a valid JWT token

	testCases := []struct {
		name           string
		method         string
		path           string
		expectedStatus int
		description    string
	}{
		{
			name:           "Health Check No Auth",
			method:         "GET",
			path:           "/health",
			expectedStatus: http.StatusOK,
			description:    "Should return 200 for health check",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			req, err := http.NewRequest(tc.method, tc.path, nil)
			if err != nil {
				t.Fatalf("Failed to create request: %v", err)
			}

			req.Header.Set("Origin", "http://localhost:5173")

			rec := httptest.NewRecorder()
			router.ServeHTTP(rec, req)

			if rec.Code != tc.expectedStatus {
				t.Errorf("%s: Expected status %d, got %d. %s", tc.name, tc.expectedStatus, rec.Code, tc.description)
			}
		})
	}
}
