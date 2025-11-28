package llm_profiles

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"net/url" // Add net/url import
	"zurabase/internal/models"

	"github.com/google/uuid"
)

// LLMProfileRequest represents a request to create or update an LLM profile
type LLMProfileRequest struct {
	Name      string `json:"name"`
	ServerURL string `json:"server_url"`
	APIKey    string `json:"api_key"`
	Model     string `json:"model"`
	IsDefault bool   `json:"is_default"`
}

// LLMProfileResponse represents the response for an LLM profile operation
type LLMProfileResponse struct {
	Profile  *models.LLMProfileResponse   `json:"profile,omitempty"`
	Profiles []*models.LLMProfileResponse `json:"profiles,omitempty"`
	Error    string                       `json:"error,omitempty"`
}

// HandleGetLLMProfiles handles GET /api/llm-profiles
func HandleGetLLMProfiles(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	// Get user ID from context (set by auth middleware)
	userID, _ := r.Context().Value("user_id").(string)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Create a timeout context
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	// Get all profiles for the user
	profiles, err := models.GetLLMProfilesByUser(ctx, userID)
	if err != nil {
		log.Printf("Error getting LLM profiles: %v", err)
		response := LLMProfileResponse{
			Error: "Failed to get LLM profiles: " + err.Error(),
		}
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(response)
		return
	}

	// Convert to response objects (omitting API keys)
	responseProfiles := make([]*models.LLMProfileResponse, 0, len(profiles))
	for _, profile := range profiles {
		responseProfiles = append(responseProfiles, profile.ToResponse())
	}

	// Return the profiles
	response := LLMProfileResponse{
		Profiles: responseProfiles,
	}
	json.NewEncoder(w).Encode(response)
}

// HandleGetLLMProfile handles GET /api/llm-profiles/:id
func HandleGetLLMProfile(w http.ResponseWriter, r *http.Request, id string) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	// Get user ID from context (set by auth middleware)
	userID, _ := r.Context().Value("user_id").(string)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Create a timeout context
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	// Get the profile
	profile, err := models.GetLLMProfile(ctx, id)
	if err != nil {
		log.Printf("Error getting LLM profile: %v", err)
		response := LLMProfileResponse{
			Error: "Failed to get LLM profile: " + err.Error(),
		}
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(response)
		return
	}

	// Verify ownership
	if profile.UserID != userID {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Return the profile (omitting API key)
	response := LLMProfileResponse{
		Profile: profile.ToResponse(),
	}
	json.NewEncoder(w).Encode(response)
}

// HandleCreateLLMProfile handles POST /api/llm-profiles
func HandleCreateLLMProfile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	// Get user ID from context (set by auth middleware)
	userID, _ := r.Context().Value("user_id").(string)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Parse request body
	var req LLMProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("Error decoding request body: %v", err)
		response := LLMProfileResponse{
			Error: "Invalid request body: " + err.Error(),
		}
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(response)
		return
	}

	// Validate request with comprehensive checks
	if validationErrors := validateLLMProfileRequest(req); len(validationErrors) > 0 {
		response := LLMProfileResponse{
			Error: strings.Join(validationErrors, "; "),
		}
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(response)
		return
	}

	// Normalize server URL to prevent endpoint duplication
	normalizedServerURL := normalizeServerURL(req.ServerURL)

	log.Printf("📝 Creating LLM profile: Name=%s, ServerURL=%s, Model=%s, IsDefault=%v",
		req.Name, normalizedServerURL, req.Model, req.IsDefault)

	// Create a new profile
	profile := &models.LLMProfile{
		ID:        uuid.New().String(),
		UserID:    userID,
		Name:      req.Name,
		ServerURL: normalizedServerURL,
		APIKey:    req.APIKey,
		Model:     req.Model,
		IsDefault: req.IsDefault,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// Create a timeout context
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	// Save the profile
	savedProfile, err := models.SaveLLMProfile(ctx, profile)
	if err != nil {
		log.Printf("Error saving LLM profile: %v", err)
		response := LLMProfileResponse{
			Error: "Failed to save LLM profile: " + err.Error(),
		}
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(response)
		return
	}

	// Return the saved profile (omitting API key)
	response := LLMProfileResponse{
		Profile: savedProfile.ToResponse(),
	}
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(response)
}

// HandleUpdateLLMProfile handles PUT /api/llm-profiles/:id
func HandleUpdateLLMProfile(w http.ResponseWriter, r *http.Request, id string) {
	if r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	// Get user ID from context (set by auth middleware)
	userID, _ := r.Context().Value("user_id").(string)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Create a timeout context
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	// Get the existing profile
	profile, err := models.GetLLMProfile(ctx, id)
	if err != nil {
		log.Printf("Error getting LLM profile: %v", err)
		response := LLMProfileResponse{
			Error: "Failed to get LLM profile: " + err.Error(),
		}
		w.WriteHeader(http.StatusNotFound)
		json.NewEncoder(w).Encode(response)
		return
	}

	// Verify ownership
	if profile.UserID != userID {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Parse request body
	var req LLMProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("Error decoding request body: %v", err)
		response := LLMProfileResponse{
			Error: "Invalid request body: " + err.Error(),
		}
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(response)
		return
	}

	// Validate request with comprehensive checks
	if validationErrors := validateLLMProfileRequest(req); len(validationErrors) > 0 {
		response := LLMProfileResponse{
			Error: strings.Join(validationErrors, "; "),
		}
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(response)
		return
	}

	log.Printf("📝 Updating LLM profile %s: Name=%s, ServerURL=%s, Model=%s, IsDefault=%v",
		id, req.Name, req.ServerURL, req.Model, req.IsDefault)

	// Update fields
	if req.Name != "" {
		profile.Name = req.Name
	}

	// Only update ServerURL if provided - normalize to prevent endpoint duplication
	if req.ServerURL != "" || req.ServerURL == "" { // Allow explicitly setting to empty string
		profile.ServerURL = normalizeServerURL(req.ServerURL)
	}

	// Only update APIKey if provided
	if req.APIKey != "" {
		profile.APIKey = req.APIKey
	}

	// Update model - always update since it's required
	profile.Model = req.Model

	// Update IsDefault
	profile.IsDefault = req.IsDefault

	profile.UpdatedAt = time.Now()

	log.Printf("✅ Profile %s updated with Model=%s", id, profile.Model)

	// Save the updated profile
	updatedProfile, err := models.SaveLLMProfile(ctx, profile)
	if err != nil {
		log.Printf("Error updating LLM profile: %v", err)
		response := LLMProfileResponse{
			Error: "Failed to update LLM profile: " + err.Error(),
		}
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(response)
		return
	}

	// Return the updated profile (omitting API key)
	response := LLMProfileResponse{
		Profile: updatedProfile.ToResponse(),
	}
	json.NewEncoder(w).Encode(response)
}

// HandleDeleteLLMProfile handles DELETE /api/llm-profiles/:id
func HandleDeleteLLMProfile(w http.ResponseWriter, r *http.Request, id string) {
	if r.Method != http.MethodDelete {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get user ID from context (set by auth middleware)
	userID, _ := r.Context().Value("user_id").(string)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Create a timeout context
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	// Get the profile to verify ownership
	profile, err := models.GetLLMProfile(ctx, id)
	if err != nil {
		http.Error(w, "LLM profile not found", http.StatusNotFound)
		return
	}

	// Verify ownership
	if profile.UserID != userID {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Delete the profile
	if err := models.DeleteLLMProfile(ctx, id); err != nil {
		log.Printf("Error deleting LLM profile: %v", err)
		http.Error(w, "Failed to delete LLM profile: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Return success
	w.WriteHeader(http.StatusNoContent)
}

// HandleSetDefaultLLMProfile handles PUT /api/llm-profiles/:id/set-default
func HandleSetDefaultLLMProfile(w http.ResponseWriter, r *http.Request, id string) {
	if r.Method != http.MethodPut {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	// Get user ID from context (set by auth middleware)
	userID, _ := r.Context().Value("user_id").(string)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Create a timeout context
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	// Set the profile as default
	err := models.SetDefaultLLMProfile(ctx, id, userID)
	if err != nil {
		log.Printf("Error setting default LLM profile: %v", err)
		response := LLMProfileResponse{
			Error: "Failed to set default LLM profile: " + err.Error(),
		}
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(response)
		return
	}

	// Get the updated profile
	profile, err := models.GetLLMProfile(ctx, id)
	if err != nil {
		log.Printf("Error getting updated LLM profile: %v", err)
		response := LLMProfileResponse{
			Error: "Profile set as default, but failed to retrieve updated profile: " + err.Error(),
		}
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(response)
		return
	}

	// Return the updated profile (omitting API key)
	response := LLMProfileResponse{
		Profile: profile.ToResponse(),
	}
	json.NewEncoder(w).Encode(response)
}

// ConnectionTestResponse represents the response for connection tests
type ConnectionTestResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message,omitempty"`
}

// respondWithConnectionTest sends a standardized connection test response
func respondWithConnectionTest(w http.ResponseWriter, success bool, message string) {
	response := ConnectionTestResponse{
		Success: success,
		Message: message,
	}

	if !success {
		w.WriteHeader(http.StatusBadRequest)
	}
	json.NewEncoder(w).Encode(response)
}

// HandleTestLLMConnection handles POST /api/llm-profiles/test-connection
func HandleTestLLMConnection(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	// Get user ID from context (set by auth middleware)
	userID, _ := r.Context().Value("user_id").(string)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Parse request body
	var req LLMProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("Error decoding request body: %v", err)
		respondWithConnectionTest(w, false, "Invalid request body: "+err.Error())
		return
	}

	// Validate request
	if req.APIKey == "" {
		respondWithConnectionTest(w, false, "API key is required")
		return
	}

	// Determine the server URL to test
	serverURL := normalizeServerURL(req.ServerURL) // Normalize the incoming URL
	if serverURL == "" {
		// Use default OpenAI API endpoint
		serverURL = "https://api.openai.com"
	}

	// Test the connection by making a simple API call
	success, message := testLLMConnection(serverURL, req.APIKey)
	respondWithConnectionTest(w, success, message)
}

// testLLMConnection performs an actual connection test to the LLM server
func testLLMConnection(serverURL, apiKey string) (bool, string) {
	log.Printf("[Debug] Testing connectivity - serverURL: '%s'", serverURL)

	if apiKey == "" {
		return false, "❌ API key is required for testing connection"
	}

	if serverURL == "" {
		return false, "❌ Server URL is required for testing connection"
	}

	// Validate URL format
	serverURL = strings.TrimSpace(serverURL)
	if !strings.HasPrefix(serverURL, "http://") && !strings.HasPrefix(serverURL, "https://") {
		return false, "❌ Server URL must start with http:// or https://"
	}

	client := &http.Client{Timeout: 15 * time.Second}

	// Always append /v1/models to the normalized base URL for testing
	testURL := fmt.Sprintf("%s/v1/models", strings.TrimSuffix(serverURL, "/"))

	log.Printf("[Debug] Testing endpoint: %s", testURL)

	req, err := http.NewRequest(http.MethodGet, testURL, nil)
	if err != nil {
		return false, fmt.Sprintf("❌ Failed to create request: %v", err)
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", apiKey))
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return false, fmt.Sprintf("❌ Connection failed - endpoint not reachable: %v", err)
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return false, fmt.Sprintf("❌ Failed to read response: %v", err)
	}

	// Check for authentication errors
	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return false, fmt.Sprintf("❌ Authentication failed - invalid API key (status %d)", resp.StatusCode)
	}

	if resp.StatusCode != http.StatusOK {
		// Try to parse error message
		var errorResp struct {
			Error struct {
				Message string `json:"message"`
				Type    string `json:"type"`
			} `json:"error"`
		}
		if json.Unmarshal(data, &errorResp) == nil && errorResp.Error.Message != "" {
			return false, fmt.Sprintf("❌ API Error: %s", errorResp.Error.Message)
		}
		return false, fmt.Sprintf("❌ Server returned status %d: %s", resp.StatusCode, string(data))
	}

	// Parse successful response
	var jsonResp struct {
		Object string `json:"object"`
		Data   []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.Unmarshal(data, &jsonResp); err == nil && jsonResp.Object == "list" {
		count := len(jsonResp.Data)
		if count > 0 {
			return true, fmt.Sprintf("✅ Connection successful - %d models available", count)
		}
	}

	return true, "✅ Connection successful"
}

// HandleTestStoredLLMConnection handles POST /api/llm-profiles/:id/test-stored-connection
func HandleTestStoredLLMConnection(w http.ResponseWriter, r *http.Request, id string) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	// Get user ID from context (set by auth middleware)
	userID, _ := r.Context().Value("user_id").(string)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Validate profile ID
	if id == "" {
		log.Printf("Error: Empty profile ID provided for test-stored-connection")
		respondWithConnectionTest(w, false, "Profile ID is required")
		return
	}

	// Create a timeout context
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	// Get the profile
	profile, err := models.GetLLMProfile(ctx, id)
	if err != nil {
		log.Printf("Error getting LLM profile: %v", err)
		w.WriteHeader(http.StatusNotFound)
		respondWithConnectionTest(w, false, "Failed to get LLM profile: "+err.Error())
		return
	}

	// Verify ownership
	if profile.UserID != userID {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Check if the API key is available
	if profile.APIKey == "" {
		log.Printf("Error: No API key found for profile %s", profile.ID)
		respondWithConnectionTest(w, false, "No API key configured for this profile")
		return
	}

	// Test the connection using the stored API key
	log.Printf("Testing stored connection for profile %s (user: %s)", profile.ID, userID)
	success, message := testLLMConnection(normalizeServerURL(profile.ServerURL), profile.APIKey) // Normalize here too
	respondWithConnectionTest(w, success, message)
}

// validateLLMProfileRequest performs comprehensive validation on LLM profile requests
func validateLLMProfileRequest(req LLMProfileRequest) []string {
	var errors []string

	// Validate profile name
	if req.Name == "" {
		errors = append(errors, "Profile name is required")
	} else if len(req.Name) > 100 {
		errors = append(errors, "Profile name must be less than 100 characters")
	} else if strings.TrimSpace(req.Name) == "" {
		errors = append(errors, "Profile name cannot be empty or only whitespace")
	}

	// Validate API key
	if req.APIKey == "" {
		errors = append(errors, "API key is required")
	} else if len(req.APIKey) < 10 {
		errors = append(errors, "API key appears to be too short (minimum 10 characters)")
	} else if strings.TrimSpace(req.APIKey) == "" {
		errors = append(errors, "API key cannot be empty or only whitespace")
	}

	// Validate server URL
	if req.ServerURL != "" {
		if !isValidURL(req.ServerURL) {
			errors = append(errors, "Invalid server URL format. Must be a valid HTTP/HTTPS URL (e.g., https://api.openai.com)")
		} else if len(req.ServerURL) > 500 {
			errors = append(errors, "Server URL must be less than 500 characters")
		}
	}

	// Validate model name - REQUIRED for LLM operations
	if req.Model == "" {
		errors = append(errors, "Model name is required (e.g., gpt-4, gpt-3.5-turbo, claude-3-opus-20240229)")
	} else if len(req.Model) > 100 {
		errors = append(errors, "Model name must be less than 100 characters")
	} else if strings.TrimSpace(req.Model) == "" {
		errors = append(errors, "Model name cannot be empty or only whitespace")
	}

	return errors
}

// isValidURL validates that a string is a valid HTTP/HTTPS URL
func isValidURL(urlStr string) bool {
	if urlStr == "" {
		return true // Empty URL is allowed (will use default)
	}

	// Basic URL validation - check for http:// or https:// prefix
	if !strings.HasPrefix(urlStr, "http://") && !strings.HasPrefix(urlStr, "https://") {
		return false
	}

	// Additional validation could be added here if needed
	return true
}

// HandleListLangChainServices handles GET /api/llm-profiles/services
// Returns a static list of supported LangChain-compatible LLM providers.
func HandleListLangChainServices(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	services := []map[string]string{
		{"id": "openai", "name": "OpenAI"},
		{"id": "anthropic", "name": "Anthropic"},
		{"id": "ollama", "name": "Ollama"},
		{"id": "together", "name": "Together.ai"},
		{"id": "huggingface", "name": "HuggingFace Hub"},
	}

	json.NewEncoder(w).Encode(map[string]interface{}{
		"services": services,
	})
}

// HandleListAvailableModels handles GET /api/llm-profiles/models
// It dynamically fetches available models from LLM providers
func HandleListAvailableModels(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	w.Header().Set("Content-Type", "application/json")

	userID, _ := r.Context().Value("user_id").(string)
	if userID == "" {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Get parameters from query string
	apiKey := r.URL.Query().Get("apiKey")
	serverURL := r.URL.Query().Get("serverURL")
	service := r.URL.Query().Get("service")

	// If no API key provided in query, try to use user's default profile
	if apiKey == "" {
		ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		defer cancel()

		profile, err := models.GetDefaultLLMProfile(ctx, userID)
		if err != nil || profile == nil {
			http.Error(w, "No API key provided and no default LLM profile found", http.StatusBadRequest)
			return
		}
		apiKey = profile.APIKey
		if serverURL == "" && profile.ServerURL != "" {
			serverURL = profile.ServerURL
		}
	}

	if serverURL == "" {
		serverURL = "https://api.openai.com"
	}
	if service == "" {
		service = "openai"
	}

	client := &http.Client{Timeout: 30 * time.Second}

	var modelURL string
	switch {
	case strings.Contains(service, "ollama"), strings.Contains(serverURL, "11434"):
		modelURL = "http://localhost:11434/api/tags"
	case strings.Contains(service, "huggingface"):
		modelURL = "https://huggingface.co/api/models"
	case strings.Contains(service, "anthropic"):
		modelURL = "https://api.anthropic.com/v1/models"
	default:
		modelURL = fmt.Sprintf("%s/v1/models", strings.TrimSuffix(serverURL, "/"))
	}

	req, err := http.NewRequest("GET", modelURL, nil)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to create model request: %v", err), http.StatusInternalServerError)
		return
	}

	if apiKey != "" {
		req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", strings.TrimSpace(apiKey)))
	} else {
		log.Printf("[Warning] No API key provided for external model request to %s", modelURL)
		http.Error(w, "API key is required to fetch models", http.StatusBadRequest)
		return
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		http.Error(w, fmt.Sprintf("Failed to contact LLM API (%s): %v", modelURL, err), http.StatusBadGateway)
		return
	}
	defer resp.Body.Close()

	body, readErr := io.ReadAll(resp.Body)
	if readErr != nil {
		http.Error(w, fmt.Sprintf("Failed to read response: %v", readErr), http.StatusInternalServerError)
		return
	}

	if resp.StatusCode != http.StatusOK {
		http.Error(w, fmt.Sprintf("Error retrieving models: %s", string(body)), resp.StatusCode)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Write(body)
}

// normalizeServerURL normalizes server URLs to prevent endpoint duplication
// Removes common API endpoint suffixes to ensure base URLs are stored
func normalizeServerURL(serverURL string) string {
	if serverURL == "" {
		return ""
	}

	// Trim whitespace and trailing slashes
	normalized := strings.TrimSpace(serverURL)
	normalized = strings.TrimSuffix(normalized, "/")

	// Parse the URL to handle different components
	u, err := url.Parse(normalized)
	if err != nil {
		log.Printf("Warning: Failed to parse URL %s for normalization: %v", serverURL, err)
		return serverURL // Return original if parsing fails
	}

	// Define common API endpoint paths to remove
	// These are paths that LangChain-Go might append, so we want the base
	endpointsToRemove := []string{
		"/v1/chat/completions",
		"/v1/models",
		"/v1/messages",
		"/api/chat",             // For Ollama
		"/api/tags",             // For Ollama
		"/api/v1/langgraph/run", // Specific LangGraph endpoint
	}

	// Check if the path component ends with any of the known endpoints
	for _, endpoint := range endpointsToRemove {
		if strings.HasSuffix(u.Path, endpoint) {
			u.Path = strings.TrimSuffix(u.Path, endpoint)
			// Ensure path starts with a slash if it's not empty
			if u.Path != "" && !strings.HasPrefix(u.Path, "/") {
				u.Path = "/" + u.Path
			}
			break // Only remove one endpoint suffix
		}
	}

	// Reconstruct the URL, ensuring no double slashes in the path
	finalURL := u.Scheme + "://" + u.Host + strings.TrimSuffix(u.Path, "/")
	return finalURL
}
