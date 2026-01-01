package services

import (
	"context"
	"os"
	"strings"
	"time"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

// Logger provides centralized structured logging functionality
type Logger struct {
	zapLogger *zap.Logger
	component string
}

// LogLevel represents the severity of a log message
type LogLevel string

const (
	LogLevelDebug LogLevel = "DEBUG"
	LogLevelInfo  LogLevel = "INFO"
	LogLevelWarn  LogLevel = "WARN"
	LogLevelError LogLevel = "ERROR"
)

// LogEntry represents a structured log message
type LogEntry struct {
	Timestamp string                 `json:"timestamp"`
	Level     LogLevel               `json:"level"`
	Component string                 `json:"component"`
	Message   string                 `json:"message"`
	Context   map[string]interface{} `json:"context"`
}

// LoggerKey is the context key for storing logger instance
type LoggerKey struct{}

// CorrelationIDKey is the context key for storing correlation ID
type CorrelationIDKey struct{}

// Config holds logging configuration
type Config struct {
	Environment string `json:"environment"` // "development" or "production"
	Level       string `json:"level"`       // "debug", "info", "warn", "error"
	OutputPath  string `json:"output_path"` // file path or "stdout"
}

// NewLogger creates a new logger instance for a specific component
func NewLogger(component string) *Logger {
	config := getLoggerConfig()
	zapLogger := createZapLogger(config, component)

	return &Logger{
		zapLogger: zapLogger,
		component: component,
	}
}

// NewLoggerWithConfig creates a new logger with custom configuration
func NewLoggerWithConfig(component string, config Config) *Logger {
	zapLogger := createZapLogger(config, component)

	return &Logger{
		zapLogger: zapLogger,
		component: component,
	}
}

// getLoggerConfig returns logging configuration based on environment
func getLoggerConfig() Config {
	env := os.Getenv("ENVIRONMENT")
	if env == "" {
		env = "development"
	}

	level := os.Getenv("LOG_LEVEL")
	if level == "" {
		if env == "production" {
			level = "info"
		} else {
			level = "debug"
		}
	}

	outputPath := os.Getenv("LOG_OUTPUT")
	if outputPath == "" {
		outputPath = "stdout"
	}

	return Config{
		Environment: env,
		Level:       level,
		OutputPath:  outputPath,
	}
}

// createZapLogger creates a zap logger based on configuration
func createZapLogger(config Config, component string) *zap.Logger {
	// Always use JSON format for consistency across all environments
	zapConfig := zap.NewProductionConfig()

	// Use ISO 8601 timestamp format for consistency
	zapConfig.EncoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder

	// Set log level
	switch strings.ToLower(config.Level) {
	case "debug":
		zapConfig.Level = zap.NewAtomicLevelAt(zap.DebugLevel)
	case "info":
		zapConfig.Level = zap.NewAtomicLevelAt(zap.InfoLevel)
	case "warn":
		zapConfig.Level = zap.NewAtomicLevelAt(zap.WarnLevel)
	case "error":
		zapConfig.Level = zap.NewAtomicLevelAt(zap.ErrorLevel)
	default:
		zapConfig.Level = zap.NewAtomicLevelAt(zap.InfoLevel)
	}

	// Set output
	if config.OutputPath != "stdout" {
		zapConfig.OutputPaths = []string{config.OutputPath}
		zapConfig.ErrorOutputPaths = []string{config.OutputPath}
	}

	// Add component as a field
	zapConfig.InitialFields = map[string]interface{}{
		"component": component,
	}

	logger, err := zapConfig.Build()
	if err != nil {
		// Fallback to basic logger if zap fails
		fallbackLogger, _ := zap.NewProduction()
		return fallbackLogger
	}

	return logger
}

// Debug logs a debug message with structured fields
func (l *Logger) Debug(message string, fields ...zap.Field) {
	l.zapLogger.Debug(message, fields...)
}

// Info logs an info message with structured fields
func (l *Logger) Info(message string, fields ...zap.Field) {
	l.zapLogger.Info(message, fields...)
}

// Warn logs a warning message with structured fields
func (l *Logger) Warn(message string, fields ...zap.Field) {
	l.zapLogger.Warn(message, fields...)
}

// Error logs an error message with structured fields
func (l *Logger) Error(message string, fields ...zap.Field) {
	l.zapLogger.Error(message, fields...)
}

// Fatal logs a fatal message with structured fields and exits the application
func (l *Logger) Fatal(message string, fields ...zap.Field) {
	l.zapLogger.Fatal(message, fields...)
}

// WithError logs an error message with error object
func (l *Logger) WithError(err error, message string, fields ...zap.Field) {
	errorField := zap.Error(err)
	allFields := append(fields, errorField)
	l.Error(message, allFields...)
}

// WithContext adds context fields to the logger
func (l *Logger) WithContext(ctx context.Context) *Logger {
	fields := []zap.Field{}

	// Add correlation ID if available
	if correlationID, ok := ctx.Value(CorrelationIDKey{}).(string); ok && correlationID != "" {
		fields = append(fields, zap.String("correlation_id", correlationID))
	}

	// Add user ID if available
	if userID, ok := ctx.Value("user_id").(string); ok && userID != "" {
		fields = append(fields, zap.String("user_id", userID))
	}

	if len(fields) > 0 {
		return &Logger{
			zapLogger: l.zapLogger.With(fields...),
			component: l.component,
		}
	}

	return l
}

// APIRequest logs an API request with structured fields
func (l *Logger) APIRequest(ctx context.Context, method, path string, userID interface{}) {
	fields := []zap.Field{
		zap.String("method", method),
		zap.String("path", path),
		zap.Any("user_id", userID),
	}

	if correlationID, ok := ctx.Value(CorrelationIDKey{}).(string); ok && correlationID != "" {
		fields = append(fields, zap.String("correlation_id", correlationID))
	}

	l.Info("API request received", fields...)
}

// APIResponse logs an API response with structured fields
func (l *Logger) APIResponse(ctx context.Context, method, path string, status int, latency time.Duration, userID interface{}) {
	fields := []zap.Field{
		zap.String("method", method),
		zap.String("path", path),
		zap.Int("status", status),
		zap.Duration("latency", latency),
		zap.Any("user_id", userID),
	}

	if correlationID, ok := ctx.Value(CorrelationIDKey{}).(string); ok && correlationID != "" {
		fields = append(fields, zap.String("correlation_id", correlationID))
	}

	if status >= 400 {
		l.Warn("API response", fields...)
	} else {
		l.Info("API response", fields...)
	}
}

// APIError logs an API error with structured fields
func (l *Logger) APIError(ctx context.Context, method, path string, err error, userID interface{}) {
	fields := []zap.Field{
		zap.String("method", method),
		zap.String("path", path),
		zap.Any("user_id", userID),
	}

	if correlationID, ok := ctx.Value(CorrelationIDKey{}).(string); ok && correlationID != "" {
		fields = append(fields, zap.String("correlation_id", correlationID))
	}

	l.WithError(err, "API error", fields...)
}

// Log processes a structured log entry (compatibility with existing code)
func (l *Logger) Log(entry LogEntry) {
	fields := []zap.Field{
		zap.String("timestamp", entry.Timestamp),
		zap.String("level", string(entry.Level)),
		zap.String("component", entry.Component),
	}

	// Add context fields
	for key, value := range entry.Context {
		fields = append(fields, zap.Any(key, value))
	}

	switch entry.Level {
	case LogLevelDebug:
		l.Debug(entry.Message, fields...)
	case LogLevelInfo:
		l.Info(entry.Message, fields...)
	case LogLevelWarn:
		l.Warn(entry.Message, fields...)
	case LogLevelError:
		l.Error(entry.Message, fields...)
	default:
		l.Info(entry.Message, fields...)
	}
}

// Sync flushes any buffered log entries
func (l *Logger) Sync() error {
	return l.zapLogger.Sync()
}

// GetZapLogger returns the underlying zap logger for advanced usage
func (l *Logger) GetZapLogger() *zap.Logger {
	return l.zapLogger
}

// Helper functions for common field types
func String(key, value string) zap.Field {
	return zap.String(key, value)
}

func Int(key string, value int) zap.Field {
	return zap.Int(key, value)
}

func Duration(key string, value time.Duration) zap.Field {
	return zap.Duration(key, value)
}

func Error(err error) zap.Field {
	return zap.Error(err)
}

func Any(key string, value interface{}) zap.Field {
	return zap.Any(key, value)
}

// GetLoggerFromContext retrieves logger from context with correlation ID
func GetLoggerFromContext(ctx context.Context, component string) *Logger {
	if logger, ok := ctx.Value(LoggerKey{}).(*Logger); ok {
		return logger.WithContext(ctx)
	}

	// Fallback to new logger with context
	logger := NewLogger(component)
	return logger.WithContext(ctx)
}

// GetCorrelationIDFromContext retrieves correlation ID from context
func GetCorrelationIDFromContext(ctx context.Context) string {
	if correlationID, ok := ctx.Value(CorrelationIDKey{}).(string); ok {
		return correlationID
	}
	return ""
}
