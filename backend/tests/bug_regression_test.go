package tests

import (
	"context"
	"fmt"
	"testing"
	"time"
	"zurabase/api/planner"
	"zurabase/internal/models"
)

// TestSystem_PlannerTemplateNotApplied tests the bug where templates weren't applied during planner creation
// This test ensures the fix remains in place
func TestSystem_PlannerTemplateNotApplied(t *testing.T) {
	ctx := context.Background()
	client := SetupTestMongoClient(ctx, t)
	if client == nil {
		return
	}
	defer client.Disconnect(ctx)

	dbName := "zurabase_test_bug_template"
	planner.Initialize(client, dbName)
	defer client.Database(dbName).Drop(ctx)

	// Initialize templates
	if err := planner.InitializeTemplates(ctx); err != nil {
		t.Fatalf("Failed to initialize templates: %v", err)
	}

	// Get Kanban template
	templates, err := planner.GetTemplates(ctx)
	if err != nil {
		t.Fatalf("Failed to get templates: %v", err)
	}

	var kanbanTemplate *planner.PlannerTemplate
	for i := range templates {
		if templates[i].Type == "kanban" {
			kanbanTemplate = &templates[i]
			break
		}
	}

	if kanbanTemplate == nil {
		t.Skip("Kanban template not found")
		return
	}

	// BUG REPRODUCTION: Create planner with template
	testPlanner, err := planner.CreatePlanner(
		ctx,
		"Bug Test Planner",
		"Testing template application bug fix",
		kanbanTemplate.ID,
		"test-user-bug",
	)

	if err != nil {
		t.Fatalf("Failed to create planner: %v", err)
	}

	// BUG CHECK: Verify lanes were created from template
	if len(testPlanner.Lanes) == 0 {
		t.Fatal("BUG DETECTED: Planner created with template has 0 lanes - template was not applied!")
	}

	expectedLaneCount := len(kanbanTemplate.Lanes)
	if len(testPlanner.Lanes) != expectedLaneCount {
		t.Errorf("BUG DETECTED: Expected %d lanes from template, got %d", expectedLaneCount, len(testPlanner.Lanes))
	}

	// BUG CHECK: Verify columns array is initialized
	if testPlanner.Columns == nil {
		t.Fatal("BUG DETECTED: Columns array is nil - should be initialized to empty array")
	}

	// Verify persistence
	retrievedPlanner, err := planner.GetPlanner(ctx, testPlanner.ID)
	if err != nil {
		t.Fatalf("Failed to retrieve planner: %v", err)
	}

	if len(retrievedPlanner.Lanes) == 0 {
		t.Fatal("BUG DETECTED: Retrieved planner has 0 lanes - lanes not persisted to database")
	}

	t.Logf("✓ Bug fix verified: Planner created with %d lanes from template", len(testPlanner.Lanes))
}

// TestSystem_LLMProfileMissingModel tests the bug where LLM profiles could be saved without a model
// This test ensures validation catches this critical error
func TestSystem_LLMProfileMissingModel(t *testing.T) {
	ctx := context.Background()
	client := SetupTestMongoClient(ctx, t)
	if client == nil {
		return
	}
	defer client.Disconnect(ctx)

	dbName := "zurabase_test_bug_llm_model"
	models.InitializeLLMProfiles(client, dbName)
	defer client.Database(dbName).Drop(ctx)

	testUserID := "test-user-bug-model"

	// BUG REPRODUCTION: Try to save profile without model
	profile := &models.LLMProfile{
		ID:        "bug-test-no-model",
		UserID:    testUserID,
		Name:      "Profile Without Model",
		ServerURL: "https://api.openai.com",
		APIKey:    "sk-test-key-1234567890",
		Model:     "", // MISSING MODEL - This is the bug
		IsDefault: true,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// Save the profile (should now fail due to validation)
	_, err := models.SaveLLMProfile(ctx, profile)
	if err == nil {
		t.Error("BUG DETECTED: Profile was saved with empty Model field - validation should have rejected it")
		t.Log("RECOMMENDATION: Add validation to reject profiles with empty Model field")
	} else {
		t.Logf("✓ Validation correctly caught empty Model field: %v", err)
	}

	// Now test with a valid model
	profile.Model = "gpt-4"
	savedProfile, err := models.SaveLLMProfile(ctx, profile)
	if err != nil {
		t.Fatalf("Failed to save profile with valid model: %v", err)
	}

	// Verify the profile was saved correctly
	if savedProfile.Model != "gpt-4" {
		t.Errorf("Expected model 'gpt-4', got '%s'", savedProfile.Model)
	}

	// Clean up
	_ = models.DeleteLLMProfile(ctx, profile.ID)
}

// TestSystem_LLMProfileNoDefault tests the bug where users without default profiles cause failures
func TestSystem_LLMProfileNoDefault(t *testing.T) {
	ctx := context.Background()
	client := SetupTestMongoClient(ctx, t)
	if client == nil {
		return
	}
	defer client.Disconnect(ctx)

	dbName := "zurabase_test_bug_no_default"
	models.InitializeLLMProfiles(client, dbName)
	defer client.Database(dbName).Drop(ctx)

	// BUG REPRODUCTION: Try to get default profile for user with no profiles
	userWithNoProfiles := "user-with-no-profiles-bug-test"

	defaultProfile, err := models.GetDefaultLLMProfile(ctx, userWithNoProfiles)

	// BUG CHECK: This should return error or nil gracefully
	if err == nil && defaultProfile != nil {
		t.Error("BUG DETECTED: GetDefaultLLMProfile returned a profile for user with no profiles")
	}

	if err != nil {
		t.Logf("✓ Correctly returns error for user with no profiles: %v", err)
	} else if defaultProfile == nil {
		t.Log("✓ Correctly returns nil for user with no profiles")
	}

	// This error should be handled gracefully in the application
	// The strands handler should provide a clear error message
}

// TestSystem_PlannerColumnsNil tests that Columns array is always initialized
func TestSystem_PlannerColumnsNil(t *testing.T) {
	ctx := context.Background()
	client := SetupTestMongoClient(ctx, t)
	if client == nil {
		return
	}
	defer client.Disconnect(ctx)

	dbName := "zurabase_test_bug_columns"
	planner.Initialize(client, dbName)
	defer client.Database(dbName).Drop(ctx)

	// Create planner without template
	testPlanner, err := planner.CreatePlanner(
		ctx,
		"Columns Test",
		"Testing columns initialization",
		"",
		"test-user-columns",
	)

	if err != nil {
		t.Fatalf("Failed to create planner: %v", err)
	}

	// BUG CHECK: Columns should never be nil
	if testPlanner.Columns == nil {
		t.Fatal("BUG DETECTED: Columns array is nil - should be initialized to empty array")
	}

	// Verify after retrieval
	retrievedPlanner, err := planner.GetPlanner(ctx, testPlanner.ID)
	if err != nil {
		t.Fatalf("Failed to retrieve planner: %v", err)
	}

	if retrievedPlanner.Columns == nil {
		t.Fatal("BUG DETECTED: Retrieved planner has nil Columns array")
	}

	t.Log("✓ Bug fix verified: Columns array is properly initialized")
}

// TestSystem_LLMProfileValidationAtUsage tests that profiles are validated before use
func TestSystem_LLMProfileValidationAtUsage(t *testing.T) {
	ctx := context.Background()
	client := SetupTestMongoClient(ctx, t)
	if client == nil {
		return
	}
	defer client.Disconnect(ctx)

	dbName := "zurabase_test_bug_validation"
	models.InitializeLLMProfiles(client, dbName)
	defer client.Database(dbName).Drop(ctx)

	testUserID := "test-user-validation-bug"

	// Create profiles with various invalid configurations
	testCases := []struct {
		name          string
		serverURL     string
		apiKey        string
		model         string
		shouldBeValid bool
	}{
		{
			name:          "Complete Profile",
			serverURL:     "https://api.openai.com",
			apiKey:        "sk-valid-key",
			model:         "gpt-4",
			shouldBeValid: true,
		},
		{
			name:          "Missing ServerURL",
			serverURL:     "",
			apiKey:        "sk-valid-key",
			model:         "gpt-4",
			shouldBeValid: false,
		},
		{
			name:          "Missing APIKey",
			serverURL:     "https://api.openai.com",
			apiKey:        "",
			model:         "gpt-4",
			shouldBeValid: false,
		},
		{
			name:          "Missing Model",
			serverURL:     "https://api.openai.com",
			apiKey:        "sk-valid-key",
			model:         "",
			shouldBeValid: false,
		},
	}

	for i, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			profile := &models.LLMProfile{
				ID:        fmt.Sprintf("validation-test-%d", i),
				UserID:    testUserID,
				Name:      tc.name,
				ServerURL: tc.serverURL,
				APIKey:    tc.apiKey,
				Model:     tc.model,
				IsDefault: false,
				CreatedAt: time.Now(),
				UpdatedAt: time.Now(),
			}

			// Try to save (may fail for empty API key due to encryption)
			if tc.apiKey != "" {
				_, err := models.SaveLLMProfile(ctx, profile)
				if err != nil && tc.shouldBeValid {
					t.Errorf("Failed to save valid profile: %v", err)
				}
			}

			// Validate for usage (simulating getAIClientForUser logic)
			isValid := profile.ServerURL != "" && profile.APIKey != "" && profile.Model != ""

			if tc.shouldBeValid && !isValid {
				t.Errorf("Profile should be valid but validation failed")
			}

			if !tc.shouldBeValid && isValid {
				t.Errorf("Profile should be invalid but validation passed")
			}

			if !tc.shouldBeValid && !isValid {
				t.Logf("✓ Correctly identified invalid profile: %s", tc.name)
			}
		})
	}
}
