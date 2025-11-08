package strands

import (
	"encoding/json"
	"net/http"
	"time"

	"zurabase/internal/services"
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

	// Log to backend console with [CLIENT] prefix
	switch logEntry.Level {
	case "error":
		logger.Error("[CLIENT] ERROR: %s | URL: %s | Stack: %s", logEntry.Message, logEntry.URL, logEntry.Stack)
	case "warn":
		logger.Warn("[CLIENT] WARN: %s | URL: %s", logEntry.Message, logEntry.URL)
	case "info":
		logger.Info("[CLIENT] INFO: %s", logEntry.Message)
	default:
		logger.Debug("[CLIENT] DEBUG: %s", logEntry.Message)
	}

	// Return success
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "logged"})
}
