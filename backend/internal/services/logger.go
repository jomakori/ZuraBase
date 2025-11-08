package services

import (
	"fmt"
	"log"
	"runtime"
	"strings"
)

// LogLevel represents the severity of a log message
type LogLevel string

const (
	LogLevelDebug LogLevel = "DEBUG"
	LogLevelInfo  LogLevel = "INFO"
	LogLevelWarn  LogLevel = "WARN"
	LogLevelError LogLevel = "ERROR"
)

// Logger provides centralized logging functionality
type Logger struct {
	module string
}

// NewLogger creates a new logger instance for a specific module
func NewLogger(module string) *Logger {
	return &Logger{module: module}
}

// formatMessage formats a log message with module and caller information
func (l *Logger) formatMessage(level LogLevel, message string, args ...interface{}) string {
	// Get caller information
	_, file, line, ok := runtime.Caller(2)
	caller := "unknown"
	if ok {
		// Extract just the filename from the full path
		parts := strings.Split(file, "/")
		if len(parts) > 0 {
			caller = fmt.Sprintf("%s:%d", parts[len(parts)-1], line)
		}
	}

	// Format the message with arguments if provided
	formattedMsg := message
	if len(args) > 0 {
		formattedMsg = fmt.Sprintf(message, args...)
	}

	return fmt.Sprintf("[%s] [%s] %s | %s", level, l.module, caller, formattedMsg)
}

// Debug logs a debug message
func (l *Logger) Debug(message string, args ...interface{}) {
	log.Println(l.formatMessage(LogLevelDebug, message, args...))
}

// Info logs an info message
func (l *Logger) Info(message string, args ...interface{}) {
	log.Println(l.formatMessage(LogLevelInfo, message, args...))
}

// Warn logs a warning message
func (l *Logger) Warn(message string, args ...interface{}) {
	log.Println(l.formatMessage(LogLevelWarn, message, args...))
}

// Error logs an error message
func (l *Logger) Error(message string, args ...interface{}) {
	log.Println(l.formatMessage(LogLevelError, message, args...))
}

// Errorf logs an error message with formatting
func (l *Logger) Errorf(format string, args ...interface{}) {
	l.Error(format, args...)
}

// WithError logs an error message with an error object
func (l *Logger) WithError(err error, message string, args ...interface{}) {
	if err != nil {
		fullMessage := fmt.Sprintf("%s: %v", message, err)
		l.Error(fullMessage, args...)
	} else {
		l.Error(message, args...)
	}
}

// APIRequest logs an API request
func (l *Logger) APIRequest(method, path string, userID interface{}) {
	l.Info("API %s %s | User: %v", method, path, userID)
}

// APIResponse logs an API response
func (l *Logger) APIResponse(method, path string, status int, userID interface{}) {
	if status >= 400 {
		l.Error("API %s %s | Status: %d | User: %v", method, path, status, userID)
	} else {
		l.Debug("API %s %s | Status: %d | User: %v", method, path, status, userID)
	}
}

// APIError logs an API error
func (l *Logger) APIError(method, path string, err error, userID interface{}) {
	l.WithError(err, "API %s %s | User: %v", method, path, userID)
}
