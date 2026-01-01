// auth/jwt.go
package auth

import (
	"context"
	"errors"
	"time"

	"github.com/golang-jwt/jwt/v4"
	"google.golang.org/api/idtoken"
)

// Claims defines the payload for JWT tokens
type Claims struct {
	UserID string `json:"user_id"`
	Email  string `json:"email"`
	jwt.RegisteredClaims
}

// GenerateToken creates a signed JWT for a user
func GenerateToken(userID, email string) (string, error) {
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

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signedToken, err := token.SignedString(GetJWTSecret())
	if err != nil {
		return "", err
	}
	return signedToken, nil
}

// ValidateToken verifies a token and extracts its claims
func ValidateToken(tokenString string) (*Claims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		return GetJWTSecret(), nil
	})

	if err != nil {
		return nil, err
	}

	if !token.Valid {
		return nil, errors.New("invalid token")
	}

	claims, ok := token.Claims.(*Claims)
	if !ok {
		return nil, errors.New("invalid token claims")
	}

	return claims, nil
}

// --- Google ID Token Verification ---

var mockGoogleVerifier func(ctx context.Context, idToken string) (*idtoken.Payload, error)

// VerifyGoogleIDToken validates a Google ID token and returns its payload.
// In production, it uses Google's public keys; in tests, it can be mocked.
func VerifyGoogleIDToken(ctx context.Context, idToken string, audience string) (*idtoken.Payload, error) {
	if mockGoogleVerifier != nil {
		return mockGoogleVerifier(ctx, idToken)
	}

	payload, err := idtoken.Validate(ctx, idToken, audience)
	if err != nil {
		return nil, errors.New("invalid Google ID token: " + err.Error())
	}
	return payload, nil
}

// SetMockGoogleVerifier allows tests to override Google token validation.
func SetMockGoogleVerifier(mock func(ctx context.Context, idToken string) (*idtoken.Payload, error)) {
	mockGoogleVerifier = mock
}
