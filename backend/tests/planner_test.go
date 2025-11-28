package tests

import (
	"context"
	"testing"
	"time"
	"zurabase/api/planner"
)

// TestPlanner_TemplateApplication tests that templates are properly applied during planner creation
func TestPlanner_TemplateApplication(t *testing.T) {
	// Setup MongoDB connection
	ctx := context.Background()
	client := SetupTestMongoClient(ctx, t)
	if client == nil {
		return
	}
	defer client.Disconnect(ctx)

	// Initialize planner collection
	dbName := "zurabase_test_planner_templates"
	planner.Initialize(client, dbName)
	defer client.Database(dbName).Drop(ctx)

	// Initialize templates
	if err := planner.InitializeTemplates(ctx); err != nil {
		t.Fatalf("Failed to initialize templates: %v", err)
	}

	// Get available templates
	templates, err := planner.GetTemplates(ctx)
	if err != nil {
		t.Fatalf("Failed to get templates: %v", err)
	}

	if len(templates) == 0 {
		t.Fatal("No templates available for testing")
	}

	// Test each template
	for _, template := range templates {
		t.Run("Template_"+template.Name, func(t *testing.T) {
			// Create a planner with this template
			testPlanner, err := planner.CreatePlanner(
				ctx,
				"Test Planner for "+template.Name,
				"Testing template application",
				template.ID,
				"test-user-123",
			)

			if err != nil {
				t.Fatalf("Failed to create planner with template %s: %v", template.Name, err)
			}

			// Verify the planner was created
			if testPlanner.ID == "" {
				t.Error("Planner ID is empty")
			}

			// Verify template ID is stored
			if testPlanner.TemplateID != template.ID {
				t.Errorf("Template ID mismatch: expected %s, got %s", template.ID, testPlanner.TemplateID)
			}

			// CRITICAL: Verify lanes were created from template
			if len(testPlanner.Lanes) == 0 {
				t.Errorf("CRITICAL BUG: Planner created with template %s has 0 lanes (expected %d lanes from template)",
					template.Name, len(template.Lanes))
			}

			expectedLaneCount := len(template.Lanes)
			if len(testPlanner.Lanes) != expectedLaneCount {
				t.Errorf("Lane count mismatch: expected %d lanes from template, got %d",
					expectedLaneCount, len(testPlanner.Lanes))
			}

			// Verify each lane has proper initialization
			for i, lane := range testPlanner.Lanes {
				if lane.ID == "" {
					t.Errorf("Lane %d has empty ID", i)
				}
				if lane.PlannerID != testPlanner.ID {
					t.Errorf("Lane %d has wrong planner ID: expected %s, got %s",
						i, testPlanner.ID, lane.PlannerID)
				}
				if lane.Title == "" {
					t.Errorf("Lane %d has empty title", i)
				}
				if lane.Cards == nil {
					t.Errorf("Lane %d has nil Cards array (should be initialized to empty array)", i)
				}
				if lane.Position == 0 && i > 0 {
					t.Errorf("Lane %d has position 0 (positions should start at 1)", i)
				}
			}

			// Verify columns array is initialized
			if testPlanner.Columns == nil {
				t.Error("CRITICAL BUG: Columns array is nil (should be initialized to empty array)")
			}

			// Retrieve the planner from database to verify persistence
			retrievedPlanner, err := planner.GetPlanner(ctx, testPlanner.ID)
			if err != nil {
				t.Fatalf("Failed to retrieve planner: %v", err)
			}

			// Verify retrieved planner has lanes
			if len(retrievedPlanner.Lanes) == 0 {
				t.Error("CRITICAL BUG: Retrieved planner has 0 lanes (lanes not persisted to database)")
			}

			if len(retrievedPlanner.Lanes) != len(testPlanner.Lanes) {
				t.Errorf("Retrieved planner lane count mismatch: expected %d, got %d",
					len(testPlanner.Lanes), len(retrievedPlanner.Lanes))
			}
		})
	}
}

// TestPlanner_WithoutTemplate tests that planners can be created without a template
func TestPlanner_WithoutTemplate(t *testing.T) {
	ctx := context.Background()
	client := SetupTestMongoClient(ctx, t)
	if client == nil {
		return
	}
	defer client.Disconnect(ctx)

	dbName := "zurabase_test_planner_no_template"
	planner.Initialize(client, dbName)
	defer client.Database(dbName).Drop(ctx)

	// Create planner without template
	testPlanner, err := planner.CreatePlanner(
		ctx,
		"Test Planner Without Template",
		"Testing planner creation without template",
		"", // Empty template ID
		"test-user-456",
	)

	if err != nil {
		t.Fatalf("Failed to create planner without template: %v", err)
	}

	// Verify planner was created
	if testPlanner.ID == "" {
		t.Error("Planner ID is empty")
	}

	// Verify lanes array is initialized (empty but not nil)
	if testPlanner.Lanes == nil {
		t.Error("Lanes array is nil (should be initialized to empty array)")
	}

	// Verify columns array is initialized (empty but not nil)
	if testPlanner.Columns == nil {
		t.Error("Columns array is nil (should be initialized to empty array)")
	}

	// Empty template should result in 0 lanes
	if len(testPlanner.Lanes) != 0 {
		t.Errorf("Expected 0 lanes for planner without template, got %d", len(testPlanner.Lanes))
	}
}

// TestPlanner_TemplateIntegrity tests that template data is correctly mapped to planner lanes
func TestPlanner_TemplateIntegrity(t *testing.T) {
	ctx := context.Background()
	client := SetupTestMongoClient(ctx, t)
	if client == nil {
		return
	}
	defer client.Disconnect(ctx)

	dbName := "zurabase_test_planner_integrity"
	planner.Initialize(client, dbName)
	defer client.Database(dbName).Drop(ctx)

	// Initialize templates
	if err := planner.InitializeTemplates(ctx); err != nil {
		t.Fatalf("Failed to initialize templates: %v", err)
	}

	// Get Kanban template specifically
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

	// Create planner with Kanban template
	testPlanner, err := planner.CreatePlanner(
		ctx,
		"Kanban Board Test",
		"Testing Kanban template integrity",
		kanbanTemplate.ID,
		"test-user-789",
	)

	if err != nil {
		t.Fatalf("Failed to create Kanban planner: %v", err)
	}

	// Verify lane names match template
	for i, templateLane := range kanbanTemplate.Lanes {
		if i >= len(testPlanner.Lanes) {
			t.Errorf("Missing lane %d: expected '%s'", i, templateLane.Name)
			continue
		}

		plannerLane := testPlanner.Lanes[i]
		if plannerLane.Title != templateLane.Name {
			t.Errorf("Lane %d title mismatch: expected '%s', got '%s'",
				i, templateLane.Name, plannerLane.Title)
		}

		if plannerLane.Description != templateLane.Description {
			t.Errorf("Lane %d description mismatch: expected '%s', got '%s'",
				i, templateLane.Description, plannerLane.Description)
		}

		if plannerLane.TemplateLaneID != templateLane.ID {
			t.Errorf("Lane %d template_lane_id mismatch: expected '%s', got '%s'",
				i, templateLane.ID, plannerLane.TemplateLaneID)
		}
	}
}

// TestPlanner_InvalidTemplate tests error handling for invalid template IDs
func TestPlanner_InvalidTemplate(t *testing.T) {
	ctx := context.Background()
	client := SetupTestMongoClient(ctx, t)
	if client == nil {
		return
	}
	defer client.Disconnect(ctx)

	dbName := "zurabase_test_planner_invalid"
	planner.Initialize(client, dbName)
	defer client.Database(dbName).Drop(ctx)

	// Try to create planner with non-existent template
	testPlanner, err := planner.CreatePlanner(
		ctx,
		"Test Invalid Template",
		"Testing invalid template handling",
		"non-existent-template-id",
		"test-user-999",
	)

	// Should still create planner (template fetch fails gracefully)
	if err != nil {
		t.Fatalf("Failed to create planner with invalid template: %v", err)
	}

	// Should have 0 lanes since template doesn't exist
	if len(testPlanner.Lanes) != 0 {
		t.Errorf("Expected 0 lanes for invalid template, got %d", len(testPlanner.Lanes))
	}

	// Arrays should still be initialized
	if testPlanner.Lanes == nil {
		t.Error("Lanes array is nil")
	}
	if testPlanner.Columns == nil {
		t.Error("Columns array is nil")
	}
}

// TestPlanner_Timestamps tests that timestamps are properly set
func TestPlanner_Timestamps(t *testing.T) {
	ctx := context.Background()
	client := SetupTestMongoClient(ctx, t)
	if client == nil {
		return
	}
	defer client.Disconnect(ctx)

	dbName := "zurabase_test_planner_timestamps"
	planner.Initialize(client, dbName)
	defer client.Database(dbName).Drop(ctx)

	beforeCreate := time.Now()

	testPlanner, err := planner.CreatePlanner(
		ctx,
		"Timestamp Test",
		"Testing timestamp creation",
		"",
		"test-user-timestamps",
	)

	if err != nil {
		t.Fatalf("Failed to create planner: %v", err)
	}

	afterCreate := time.Now()

	// Verify CreatedAt is set and reasonable
	if testPlanner.CreatedAt.IsZero() {
		t.Error("CreatedAt is zero")
	}

	if testPlanner.CreatedAt.Before(beforeCreate) || testPlanner.CreatedAt.After(afterCreate) {
		t.Errorf("CreatedAt timestamp out of range: %v (expected between %v and %v)",
			testPlanner.CreatedAt, beforeCreate, afterCreate)
	}

	// Verify UpdatedAt is set
	if testPlanner.UpdatedAt.IsZero() {
		t.Error("UpdatedAt is zero")
	}

	// CreatedAt and UpdatedAt should be very close for new planners
	timeDiff := testPlanner.UpdatedAt.Sub(testPlanner.CreatedAt)
	if timeDiff < 0 || timeDiff > time.Second {
		t.Errorf("CreatedAt and UpdatedAt differ by %v (should be nearly identical for new planner)", timeDiff)
	}
}
