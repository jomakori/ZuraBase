package httputil

import (
	"encoding/json"
	"net/http"

	"zurabase/internal/services"

	"github.com/gin-gonic/gin"
)

// WriteJSONError writes a standardized JSON error response for HTTP handlers.
// It includes correlation ID from request context if available.
func WriteJSONError(w http.ResponseWriter, r *http.Request, message string, statusCode int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	response := map[string]interface{}{"error": message}
	if correlationID := r.Context().Value(services.CorrelationIDKey{}); correlationID != nil {
		response["correlation_id"] = correlationID
	}
	json.NewEncoder(w).Encode(response)
}

// WriteJSONErrorGin writes a standardized JSON error response for Gin handlers.
// It includes correlation ID from request context if available.
func WriteJSONErrorGin(c *gin.Context, message string, statusCode int) {
	response := gin.H{"error": message}
	if correlationID := c.Request.Context().Value(services.CorrelationIDKey{}); correlationID != nil {
		response["correlation_id"] = correlationID
	}
	c.AbortWithStatusJSON(statusCode, response)
}
