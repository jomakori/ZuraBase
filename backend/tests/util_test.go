package tests

import "testing"

// TestSystem_EnvironmentSetup tests that environment variables are properly loaded
func TestSystem_EnvironmentSetup(t *testing.T) {
	// Test that required environment variables are available
	requiredVars := []string{"MONGO_URI", "MONGO_DB_NAME", "LLM_ENCRYPTION_KEY", "JWT_SECRET", "API_ENDPOINT"}

	for _, envVar := range requiredVars {
		switch envVar {
		case "API_ENDPOINT":
			if GetAPIEndpoint() == "" {
				t.Errorf("API_ENDPOINT environment variable must be set")
			}
		case "MONGO_URI":
			if GetMongoURI() == "" {
				t.Errorf("MONGO_URI environment variable must be set")
			}
		case "LLM_ENCRYPTION_KEY":
			if GetLLMEncryptionKey() == "" {
				t.Errorf("LLM_ENCRYPTION_KEY environment variable must be set")
			}
		case "JWT_SECRET":
			if GetJWTSecret() == "" {
				t.Errorf("JWT_SECRET environment variable must be set")
			}
		case "MONGO_DB_NAME":
			if GetMongoDBName() == "" {
				t.Errorf("MONGO_DB_NAME environment variable must be set")
			}
		}
	}
}

// TestSystem_UtilityFunctions tests the utility functions
func TestSystem_UtilityFunctions(t *testing.T) {
	// Test API endpoint function
	apiEndpoint := GetAPIEndpoint()
	if apiEndpoint == "" {
		t.Error("GetAPIEndpoint should return a non-empty string")
	}

	// Test MongoDB URI function
	mongoURI := GetMongoURI()
	if mongoURI == "" {
		t.Error("GetMongoURI should return a non-empty string")
	}

	// Test LLM encryption key function
	encryptionKey := GetLLMEncryptionKey()
	if encryptionKey == "" {
		t.Error("GetLLMEncryptionKey should return a non-empty string")
	}

	// Test JWT secret function
	jwtSecret := GetJWTSecret()
	if jwtSecret == "" {
		t.Error("GetJWTSecret should return a non-empty string")
	}

	// Test MongoDB name function
	dbName := GetMongoDBName()
	if dbName == "" {
		t.Error("GetMongoDBName should return a non-empty string")
	}
}
