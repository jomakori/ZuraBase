package services

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"go.uber.org/zap"
)

// LoggingMiddleware creates a Gin middleware for structured request logging
func LoggingMiddleware(logger *Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Start timer
		start := time.Now()

		// Generate or extract correlation ID
		correlationID := c.GetHeader("X-Correlation-ID")
		if correlationID == "" {
			correlationID = generateCorrelationID()
		}

		// Set correlation ID in context
		ctx := context.WithValue(c.Request.Context(), CorrelationIDKey{}, correlationID)
		ctx = context.WithValue(ctx, LoggerKey{}, logger)
		c.Request = c.Request.WithContext(ctx)

		// Set correlation ID in response header
		c.Header("X-Correlation-ID", correlationID)

		// Create request-scoped logger with correlation ID
		requestLogger := logger.WithContext(ctx)

		// Log request
		userID := getUserIDFromContext(ctx)
		requestLogger.APIRequest(ctx, c.Request.Method, c.Request.URL.Path, userID)

		// Process request
		c.Next()

		// Calculate latency
		latency := time.Since(start)

		// Log response
		requestLogger.APIResponse(ctx, c.Request.Method, c.Request.URL.Path, c.Writer.Status(), latency, userID)
	}
}

// ErrorHandlingMiddleware creates a Gin middleware for structured error logging
func ErrorHandlingMiddleware(logger *Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		// Check if there are any errors to log
		if len(c.Errors) > 0 {
			ctx := c.Request.Context()
			userID := getUserIDFromContext(ctx)

			for _, ginErr := range c.Errors {
				logger.APIError(ctx, c.Request.Method, c.Request.URL.Path, ginErr.Err, userID)
			}
		}
	}
}

// RequestLoggerMiddleware creates a comprehensive logging middleware that combines both logging and error handling
func RequestLoggerMiddleware(logger *Logger) gin.HandlerFunc {
	loggingMiddleware := LoggingMiddleware(logger)
	errorMiddleware := ErrorHandlingMiddleware(logger)

	return func(c *gin.Context) {
		// Apply logging middleware
		loggingMiddleware(c)

		// Apply error middleware
		errorMiddleware(c)
	}
}

// generateCorrelationID creates a unique correlation ID for request tracking
func generateCorrelationID() string {
	return fmt.Sprintf("req-%s", uuid.New().String()[:8])
}

// getUserIDFromContext extracts user ID from context
func getUserIDFromContext(ctx context.Context) interface{} {
	if userID, ok := ctx.Value("user_id").(string); ok {
		return userID
	}
	return nil
}

// LoggingFieldsMiddleware adds structured logging fields to the Gin context
func LoggingFieldsMiddleware(logger *Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Add common request fields to logger
		fields := []zap.Field{
			zap.String("method", c.Request.Method),
			zap.String("path", c.Request.URL.Path),
			zap.String("user_agent", c.Request.UserAgent()),
			zap.String("remote_ip", c.ClientIP()),
		}

		// Add correlation ID if available
		if correlationID := GetCorrelationIDFromContext(c.Request.Context()); correlationID != "" {
			fields = append(fields, zap.String("correlation_id", correlationID))
		}

		// Add user ID if available
		if userID := getUserIDFromContext(c.Request.Context()); userID != nil {
			fields = append(fields, zap.Any("user_id", userID))
		}

		// Create enhanced logger with request fields
		enhancedLogger := &Logger{
			zapLogger: logger.zapLogger.With(fields...),
			component: logger.component,
		}

		// Store enhanced logger in context
		ctx := context.WithValue(c.Request.Context(), LoggerKey{}, enhancedLogger)
		c.Request = c.Request.WithContext(ctx)

		c.Next()
	}
}

// StructuredLoggingMiddleware provides a complete structured logging solution
func StructuredLoggingMiddleware(component string) gin.HandlerFunc {
	logger := NewLogger(component)

	return func(c *gin.Context) {
		// Start timer
		start := time.Now()

		// Generate or extract correlation ID
		correlationID := c.GetHeader("X-Correlation-ID")
		if correlationID == "" {
			correlationID = generateCorrelationID()
		}

		// Set correlation ID in context and response
		ctx := context.WithValue(c.Request.Context(), CorrelationIDKey{}, correlationID)
		c.Request = c.Request.WithContext(ctx)
		c.Header("X-Correlation-ID", correlationID)

		// Create request-scoped logger
		requestLogger := logger.WithContext(ctx)

		// Log request with structured fields
		requestFields := []zap.Field{
			zap.String("correlation_id", correlationID),
			zap.String("method", c.Request.Method),
			zap.String("path", c.Request.URL.Path),
			zap.String("user_agent", c.Request.UserAgent()),
			zap.String("remote_ip", c.ClientIP()),
		}

		if userID := getUserIDFromContext(ctx); userID != nil {
			requestFields = append(requestFields, zap.Any("user_id", userID))
		}

		requestLogger.Info("HTTP request started", requestFields...)

		// Process request
		c.Next()

		// Calculate latency
		latency := time.Since(start)

		// Log response with structured fields
		responseFields := []zap.Field{
			zap.String("correlation_id", correlationID),
			zap.String("method", c.Request.Method),
			zap.String("path", c.Request.URL.Path),
			zap.Int("status", c.Writer.Status()),
			zap.Duration("latency", latency),
			zap.Int("response_size", c.Writer.Size()),
		}

		if userID := getUserIDFromContext(ctx); userID != nil {
			responseFields = append(responseFields, zap.Any("user_id", userID))
		}

		// Log based on status code
		if c.Writer.Status() >= 400 {
			requestLogger.Warn("HTTP request completed with error", responseFields...)
		} else {
			requestLogger.Info("HTTP request completed successfully", responseFields...)
		}

		// Log any Gin errors
		if len(c.Errors) > 0 {
			for _, ginErr := range c.Errors {
				errorFields := append(responseFields, zap.Error(ginErr.Err))
				requestLogger.Error("HTTP request error", errorFields...)
			}
		}
	}
}

// HealthCheckLoggingMiddleware provides specialized logging for health check endpoints
func HealthCheckLoggingMiddleware(logger *Logger) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Skip detailed logging for health checks to reduce noise
		if strings.HasSuffix(c.Request.URL.Path, "/health") {
			start := time.Now()
			c.Next()
			latency := time.Since(start)

			logger.Debug("Health check request",
				zap.String("method", c.Request.Method),
				zap.String("path", c.Request.URL.Path),
				zap.Int("status", c.Writer.Status()),
				zap.Duration("latency", latency),
			)
			return
		}

		// Use standard logging for other endpoints
		StructuredLoggingMiddleware("http_server")(c)
	}
}

// GetLoggerFromGinContext retrieves logger from Gin context
func GetLoggerFromGinContext(c *gin.Context, component string) *Logger {
	if logger, ok := c.Request.Context().Value(LoggerKey{}).(*Logger); ok {
		return logger.WithContext(c.Request.Context())
	}

	// Fallback to new logger with context
	logger := NewLogger(component)
	return logger.WithContext(c.Request.Context())
}

// LogGinError logs a Gin error with structured fields
func LogGinError(c *gin.Context, err error, message string) {
	logger := GetLoggerFromGinContext(c, "gin_error")
	logger.WithError(err, message,
		zap.String("method", c.Request.Method),
		zap.String("path", c.Request.URL.Path),
		zap.Int("status", c.Writer.Status()),
	)
}
