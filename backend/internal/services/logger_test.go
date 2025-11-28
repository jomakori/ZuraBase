package services

import (
	"context"
	"fmt"
	"os"
	"testing"
	"time"
)

func TestLoggerDevelopment(t *testing.T) {
	// Set environment for development
	os.Setenv("ENVIRONMENT", "development")
	os.Setenv("LOG_LEVEL", "debug")

	logger := NewLogger("test_development")

	// Test basic logging
	logger.Info("Development info test")
	logger.Warn("Development warning test")
	logger.Error("Development error test")

	// Test with structured fields
	logger.Info("Structured log test",
		String("user_id", "test-user-123"),
		Int("attempt", 5),
		Duration("latency", 150*time.Millisecond),
	)

	// Test error with context
	logger.WithError(fmt.Errorf("test error occurred"), "Error with context test",
		String("operation", "test_operation"),
	)
}

func TestLoggerProduction(t *testing.T) {
	// Set environment for production
	os.Setenv("ENVIRONMENT", "production")
	os.Setenv("LOG_LEVEL", "info")

	logger := NewLogger("test_production")

	// Test production logging (should output JSON)
	logger.Info("Production info test - should be JSON format")
	logger.Warn("Production warning with structured data",
		String("component", "api"),
		Int("status_code", 429),
		Any("metadata", map[string]interface{}{
			"user_agent": "test-agent",
			"ip":         "192.168.1.1",
		}),
	)
}

func TestLoggerWithContext(t *testing.T) {
	os.Setenv("ENVIRONMENT", "development")
	os.Setenv("LOG_LEVEL", "debug")

	logger := NewLogger("test_context")

	// Create context with correlation ID and user ID
	ctx := context.WithValue(context.Background(), CorrelationIDKey{}, "test-correlation-abc123")
	ctx = context.WithValue(ctx, "user_id", "test-user-456")

	// Test context-aware logging
	contextLogger := logger.WithContext(ctx)
	contextLogger.Info("Context-aware log with correlation ID")

	// Test API logging methods
	logger.APIRequest(ctx, "GET", "/api/test", "test-user")
	logger.APIResponse(ctx, "GET", "/api/test", 200, 150*time.Millisecond, "test-user")
	logger.APIError(ctx, "POST", "/api/error", fmt.Errorf("api error occurred"), "test-user")
}

func TestLogEntryCompatibility(t *testing.T) {
	os.Setenv("ENVIRONMENT", "development")
	os.Setenv("LOG_LEVEL", "debug")

	logger := NewLogger("test_compatibility")

	// Test legacy LogEntry compatibility
	logEntry := LogEntry{
		Timestamp: time.Now().Format(time.RFC3339),
		Level:     LogLevelInfo,
		Component: "legacy_component",
		Message:   "Legacy log entry test",
		Context: map[string]interface{}{
			"old_field": "value",
			"count":     42,
			"duration":  "2s",
		},
	}

	logger.Log(logEntry)
}

func TestLoggerConfiguration(t *testing.T) {
	// Test different log levels
	testCases := []struct {
		level    string
		expected string
	}{
		{"debug", "debug"},
		{"info", "info"},
		{"warn", "warn"},
		{"error", "error"},
	}

	for _, tc := range testCases {
		t.Run(tc.level, func(t *testing.T) {
			os.Setenv("LOG_LEVEL", tc.level)
			logger := NewLogger("test_level_" + tc.level)
			logger.Info("Testing log level: " + tc.level)
		})
	}
}
