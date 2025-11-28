package logs

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"go.uber.org/zap"
	"zurabase/internal/services"
)

// LogEntry represents a structured log entry from the frontend
type LogEntry struct {
	Timestamp     string                 `json:"timestamp"`
	Level         string                 `json:"level"`
	Component     string                 `json:"component"`
	Message       string                 `json:"message"`
	Context       map[string]interface{} `json:"context"`
	CorrelationID string                 `json:"correlation_id,omitempty"`
	Environment   string                 `json:"environment,omitempty"`
	UserAgent     string                 `json:"user_agent,omitempty"`
	UserID        string                 `json:"user_id,omitempty"`
	SessionID     string                 `json:"session_id,omitempty"`
}

// LogRequest represents the request body for log ingestion
type LogRequest struct {
	Logs []LogEntry `json:"logs"`
}

// LogResponse represents the response for log ingestion
type LogResponse struct {
	Status    string `json:"status"`
	Message   string `json:"message,omitempty"`
	Processed int    `json:"processed,omitempty"`
	Failed    int    `json:"failed,omitempty"`
	Error     string `json:"error,omitempty"`
}

// Rate limiting configuration
const (
	maxRequestSize       = 1 * 1024 * 1024 // 1 MB
	maxLogsPerRequest    = 100
	rateLimitWindow      = time.Second
	rateLimitMaxRequests = 10
)

// rateLimiter tracks request counts per user/session
var rateLimiter = make(map[string][]time.Time)

// HandleLogIngestion handles POST /api/logs for receiving frontend logs
func HandleLogIngestion(w http.ResponseWriter, r *http.Request) {
	// Get logger from context
	logger := services.GetLoggerFromContext(r.Context(), "log_ingestion")

	// Log the incoming request
	logger.APIRequest(r.Context(), r.Method, r.URL.Path, r.Context().Value("user_id"))

	startTime := time.Now()
	defer func() {
		logger.APIResponse(r.Context(), r.Method, r.URL.Path, http.StatusAccepted, time.Since(startTime), r.Context().Value("user_id"))
	}()

	// Set response headers
	w.Header().Set("Content-Type", "application/json")

	// Only accept POST requests
	if r.Method != http.MethodPost {
		logger.Warn("Invalid method for log ingestion",
			services.String("method", r.Method),
			services.String("expected", "POST"))
		http.Error(w, `{"error": "method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	// Apply rate limiting
	if err := applyRateLimit(r); err != nil {
		logger.Warn("Rate limit exceeded", services.Error(err))
		http.Error(w, `{"error": "rate limit exceeded"}`, http.StatusTooManyRequests)
		return
	}

	// Limit request size
	r.Body = http.MaxBytesReader(w, r.Body, maxRequestSize)

	// Parse request body
	var req LogRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		logger.Warn("Invalid request body", services.Error(err))
		http.Error(w, `{"error": "invalid request body"}`, http.StatusBadRequest)
		return
	}

	// Validate log entries
	if len(req.Logs) == 0 {
		logger.Warn("Empty log array in request")
		http.Error(w, `{"error": "no logs provided"}`, http.StatusBadRequest)
		return
	}

	// Limit number of logs per request
	if len(req.Logs) > maxLogsPerRequest {
		logger.Warn("Too many logs in single request",
			services.Int("received", len(req.Logs)),
			services.Int("max_allowed", maxLogsPerRequest))
		http.Error(w, `{"error": "too many logs in single request"}`, http.StatusBadRequest)
		return
	}

	// Process logs
	processed, failed := processLogs(r.Context(), req.Logs, logger)

	// Prepare response
	response := LogResponse{
		Status:    "accepted",
		Message:   "Logs processed successfully",
		Processed: processed,
		Failed:    failed,
	}

	if failed > 0 {
		response.Message = fmt.Sprintf("Processed %d logs, %d failed", processed, failed)
	}

	// Return 202 Accepted
	w.WriteHeader(http.StatusAccepted)
	if err := json.NewEncoder(w).Encode(response); err != nil {
		logger.Error("Failed to encode response", services.Error(err))
		http.Error(w, `{"error": "failed to encode response"}`, http.StatusInternalServerError)
	}
}

// applyRateLimit implements basic rate limiting (10 requests/sec per user/session)
func applyRateLimit(r *http.Request) error {
	// Get rate limit key (user ID if available, otherwise session ID from correlation header)
	rateLimitKey := getRateLimitKey(r)

	// Clean up old entries
	now := time.Now()
	cleanupRateLimiter(now)

	// Check if rate limit exceeded
	requests := rateLimiter[rateLimitKey]
	if len(requests) >= rateLimitMaxRequests {
		oldest := requests[0]
		if now.Sub(oldest) < rateLimitWindow {
			return fmt.Errorf("rate limit exceeded for key: %s", rateLimitKey)
		}
	}

	// Add current request
	rateLimiter[rateLimitKey] = append(requests, now)
	return nil
}

// getRateLimitKey generates a key for rate limiting based on user/session
func getRateLimitKey(r *http.Request) string {
	// Try to use user ID first
	if userID, ok := r.Context().Value("user_id").(string); ok && userID != "" {
		return "user:" + userID
	}

	// Fall back to session/correlation ID
	correlationID := r.Header.Get("X-Correlation-ID")
	if correlationID != "" {
		return "session:" + correlationID
	}

	// Final fallback to IP (basic protection)
	ip := strings.Split(r.RemoteAddr, ":")[0]
	return "ip:" + ip
}

// cleanupRateLimiter removes old entries from rate limiter
func cleanupRateLimiter(now time.Time) {
	for key, requests := range rateLimiter {
		validRequests := make([]time.Time, 0)
		for _, reqTime := range requests {
			if now.Sub(reqTime) < rateLimitWindow {
				validRequests = append(validRequests, reqTime)
			}
		}
		if len(validRequests) == 0 {
			delete(rateLimiter, key)
		} else {
			rateLimiter[key] = validRequests
		}
	}
}

// processLogs processes individual log entries and forwards to centralized logger
func processLogs(ctx context.Context, logs []LogEntry, logger *services.Logger) (processed, failed int) {
	for _, logEntry := range logs {
		if err := processSingleLog(ctx, logEntry, logger); err != nil {
			logger.Warn("Failed to process log entry",
				services.Error(err),
				services.String("component", logEntry.Component),
				services.String("level", logEntry.Level))
			failed++
		} else {
			processed++
		}
	}
	return
}

// processSingleLog processes a single log entry and forwards to centralized logger
func processSingleLog(ctx context.Context, entry LogEntry, logger *services.Logger) error {
	// Validate required fields
	if entry.Timestamp == "" || entry.Level == "" || entry.Component == "" || entry.Message == "" {
		return fmt.Errorf("missing required log fields")
	}

	// Parse timestamp to ensure it's valid
	if _, err := time.Parse(time.RFC3339, entry.Timestamp); err != nil {
		// If timestamp is invalid, use current time
		entry.Timestamp = time.Now().Format(time.RFC3339)
	}

	// Create structured fields for the centralized logger
	fields := []zap.Field{
		zap.String("timestamp", entry.Timestamp),
		zap.String("component", entry.Component),
		zap.String("source", "frontend"),
	}

	// Add correlation ID if available
	if entry.CorrelationID != "" {
		fields = append(fields, zap.String("correlation_id", entry.CorrelationID))
	}

	// Add user ID if available (prefer authenticated user ID from context)
	if userID, ok := ctx.Value("user_id").(string); ok && userID != "" {
		fields = append(fields, zap.String("user_id", userID))
	} else if entry.UserID != "" {
		fields = append(fields, zap.String("user_id", entry.UserID))
	}

	// Add session ID if available
	if entry.SessionID != "" {
		fields = append(fields, zap.String("session_id", entry.SessionID))
	}

	// Add environment and user agent
	if entry.Environment != "" {
		fields = append(fields, zap.String("environment", entry.Environment))
	}
	if entry.UserAgent != "" {
		fields = append(fields, zap.String("user_agent", entry.UserAgent))
	}

	// Add context fields
	for key, value := range entry.Context {
		fields = append(fields, zap.Any(key, value))
	}

	// Forward to centralized logger based on log level
	switch strings.ToLower(entry.Level) {
	case "debug":
		logger.Debug(entry.Message, fields...)
	case "info":
		logger.Info(entry.Message, fields...)
	case "warn", "warning":
		logger.Warn(entry.Message, fields...)
	case "error":
		logger.Error(entry.Message, fields...)
	default:
		// Default to info level for unknown levels
		logger.Info(entry.Message, fields...)
	}

	return nil
}

// Initialize sets up the logs package
func Initialize() error {
	logger := services.NewLogger("log_ingestion")
	logger.Info("Log ingestion API initialized")
	return nil
}
