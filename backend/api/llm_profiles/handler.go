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

	"zurabase/models"

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

	// Validate request
	if req.Name == "" {
		response := LLMProfileResponse{
			Error: "Profile name is required",
		}
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(response)
		return
	}

	if len(req.Name) > 100 {
		response := LLMProfileResponse{
			Error: "Profile name must be less than 100 characters",
		}
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(response)
		return
	}

	// API key is required
	if req.APIKey == "" {
		response := LLMProfileResponse{
			Error: "API key is required",
		}
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(response)
		return
	}

	// Validate server URL format if provided
	if req.ServerURL != "" {
		if !isValidURL(req.ServerURL) {
			response := LLMProfileResponse{
				Error: "Invalid server URL format. Must be a valid HTTP/HTTPS URL",
			}
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(response)
			return
		}
	}

	// Create a new profile
	profile := &models.LLMProfile{
		ID:        uuid.New().String(),
		UserID:    userID,
		Name:      req.Name,
		ServerURL: req.ServerURL,
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

	// Validate request
	if req.Name != "" && len(req.Name) > 100 {
		response := LLMProfileResponse{
			Error: "Profile name must be less than 100 characters",
		}
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(response)
		return
	}

	// Validate server URL format if provided
	if req.ServerURL != "" {
		if !isValidURL(req.ServerURL) {
			response := LLMProfileResponse{
				Error: "Invalid server URL format. Must be a valid HTTP/HTTPS URL",
			}
			w.WriteHeader(http.StatusBadRequest)
			json.NewEncoder(w).Encode(response)
			return
		}
	}

	// Update fields
	if req.Name != "" {
		profile.Name = req.Name
	}

	// Only update ServerURL if provided
	if req.ServerURL != "" || req.ServerURL == "" { // Allow explicitly setting to empty string
		profile.ServerURL = req.ServerURL
	}

	// Only update APIKey if provided
	if req.APIKey != "" {
		profile.APIKey = req.APIKey
	}

	// Update model if provided
	if req.Model != "" {
		profile.Model = req.Model
	}

	// Update IsDefault
	profile.IsDefault = req.IsDefault

	profile.UpdatedAt = time.Now()

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
		response := map[string]interface{}{
			"success": false,
			"error":   "Invalid request body: " + err.Error(),
		}
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(response)
		return
	}

	// Validate request
	if req.APIKey == "" {
		response := map[string]interface{}{
			"success": false,
			"error":   "API key is required",
		}
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(response)
		return
	}

	// Determine the server URL to test
	serverURL := req.ServerURL
	if serverURL == "" {
		// Use default OpenAI API endpoint
		serverURL = "https://api.openai.com"
	}

	// Test the connection by making a simple API call
	success, message := testLLMConnection(serverURL, req.APIKey)

	response := map[string]interface{}{
		"success": success,
		"message": message,
	}

	if !success {
		w.WriteHeader(http.StatusBadRequest)
	}
	json.NewEncoder(w).Encode(response)
}

// Correct misplaced code after the last closing brace
// Ensure file ends cleanly and remove lingering incomplete syntax blocks

// testLLMConnection performs an actual connection test to the LLM server
func testLLMConnection(serverURL, apiKey string) (bool, string) {
	log.Printf("[Debug] Testing connectivity - serverURL: '%s'", serverURL)

	if apiKey == "" {
		return false, "API key required for testing connection"
	}

	// FIX: Ensure proper default URL if empty
	if serverURL == "" {
		serverURL = "https://api.openai.com"
		log.Printf("[Debug] Using default serverURL: %s", serverURL)
	}

	// FIX: Ensure proper URL scheme
	serverURL = strings.TrimSpace(serverURL)
	if !strings.HasPrefix(serverURL, "http://") && !strings.HasPrefix(serverURL, "https://") {
		serverURL = "https://" + strings.TrimPrefix(serverURL, "/")
		log.Printf("[Debug] Added scheme, serverURL: %s", serverURL)
	}

	client := &http.Client{Timeout: 15 * time.Second}
	// FIX: Proper path construction
	baseURL := strings.TrimSuffix(serverURL, "/")
	url := fmt.Sprintf("%s/v1/models", baseURL)
	log.Printf("[Debug] Final URL: %s", url)

	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return false, fmt.Sprintf("Failed to create request: %v", err)
	}

	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", apiKey))
	req.Header.Set("Content-Type", "application/json")

	resp, err := client.Do(req)
	if err != nil {
		return false, fmt.Sprintf("Connection failed: %v", err)
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return false, fmt.Sprintf("Failed to read response: %v", err)
	}

	if resp.StatusCode != http.StatusOK {
		return false, fmt.Sprintf("Server returned status %d: %s", resp.StatusCode, string(data))
	}

	var jsonResp struct {
		Object string `json:"object"`
		Data   []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if err := json.Unmarshal(data, &jsonResp); err == nil && jsonResp.Object == "list" {
		count := len(jsonResp.Data)
		if count > 0 {
			return true, fmt.Sprintf("Connection successful - %d models available", count)
		}
	}

	return true, "Connection successful but no models found"
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
		response := map[string]interface{}{
			"success": false,
			"error":   "Profile ID is required",
		}
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(response)
		return
	}

	// Create a timeout context
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	// Get the profile
	profile, err := models.GetLLMProfile(ctx, id)
	if err != nil {
		log.Printf("Error getting LLM profile: %v", err)
		response := map[string]interface{}{
			"success": false,
			"error":   "Failed to get LLM profile: " + err.Error(),
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

	// Check if the API key is available
	if profile.APIKey == "" {
		log.Printf("Error: No API key found for profile %s", profile.ID)
		response := map[string]interface{}{
			"success": false,
			"message": "No API key configured for this profile",
		}
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(response)
		return
	}

	// Test the connection using the stored API key
	log.Printf("Testing stored connection for profile %s (user: %s)", profile.ID, userID)
	success, message := testLLMConnection(profile.ServerURL, profile.APIKey)

	response := map[string]interface{}{
		"success": success,
		"message": message,
	}

	if !success {
		w.WriteHeader(http.StatusBadRequest)
	}
	json.NewEncoder(w).Encode(response)
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
