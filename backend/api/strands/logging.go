package strands

import (
	"encoding/json"
	"net/http"
	"time"

	"zurabase/internal/services"

	"go.uber.org/zap"
)

var logger = services.NewLogger("ClientLogs")

// ClientLogEntry represents a log entry from the frontend
type ClientLogEntry struct {
	Level     string                 `json:"level"` // error, warn, info, debug
	Message   string                 `json:"message"`
	Timestamp time.Time              `json:"timestamp"`
	UserAgent string                 `json:"user_agent,omitempty"`
	URL       string                 `json:"url,omitempty"`
	Stack     string                 `json:"stack,omitempty"`
	Context   map[string]interface{} `json:"context,omitempty"`
}

// HandleClientLogs handles POST /strands/client-logs
func HandleClientLogs(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, `{"error": "method not allowed"}`, http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	var logEntry ClientLogEntry
	if err := json.NewDecoder(r.Body).Decode(&logEntry); err != nil {
		logger.WithError(err, "Error decoding client log")
		http.Error(w, `{"error": "invalid request body"}`, http.StatusBadRequest)
		return
	}

	// Create structured fields for the log entry
	fields := []zap.Field{
		zap.String("source", "client"),
		zap.String("user_agent", logEntry.UserAgent),
		zap.String("url", logEntry.URL),
		zap.Time("client_timestamp", logEntry.Timestamp),
	}

	// Add stack trace for errors
	if logEntry.Stack != "" {
		fields = append(fields, zap.String("stack", logEntry.Stack))
	}

	// Add context fields
	for key, value := range logEntry.Context {
		fields = append(fields, zap.Any(key, value))
	}

	// Log to backend console with structured fields
	switch logEntry.Level {
	case "error":
		logger.Error("Client error", fields...)
	case "warn":
		logger.Warn("Client warning", fields...)
	case "info":
		logger.Info("Client info", fields...)
	default:
		logger.Debug("Client debug", fields...)
	}

	// Return success
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "logged"})
}
