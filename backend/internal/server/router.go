package server

import (
	"context"
	"net/http"
	"os"
	"strings"
	"zurabase/api/llm_profiles"
	"zurabase/api/notes"
	"zurabase/api/pexels"
	"zurabase/api/planner"
	"zurabase/api/strands"
	"zurabase/internal/auth"
	"zurabase/internal/logs"
	"zurabase/internal/models"
	"zurabase/internal/services"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// SetupRouter creates and configures the Gin router with CORS middleware and all routes
func SetupRouter(logger *services.Logger) *gin.Engine {
	// Ensure Gin runs in release mode unless explicitly set
	if os.Getenv("GIN_MODE") == "" {
		gin.SetMode(gin.ReleaseMode)
	}

	router := gin.New()

	// Global recovery middleware to prevent panics from crashing tests
	router.Use(gin.Recovery())

	// Configure CORS middleware
	corsConfig := cors.Config{
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Authorization", "Content-Type"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * 60 * 60, // 12 hours
	}

	// Set allowed origins from environment variable or fallback to localhost
	allowedOrigins := os.Getenv("ALLOWED_ORIGINS")
	if allowedOrigins == "" {
		corsConfig.AllowOrigins = []string{"http://localhost:5173", "http://localhost:8181"}
	} else {
		corsConfig.AllowOrigins = strings.Split(allowedOrigins, ",")
	}

	// Apply CORS middleware
	router.Use(cors.New(corsConfig))

	// Apply logging middleware
	router.Use(services.LoggingMiddleware(logger))

	// Setup all routes directly with Gin
	setupGinRoutes(router)

	return router
}

// SetupTestRouter returns the backend Gin router for testing
func SetupTestRouter() *gin.Engine {
	logger := services.NewLogger("test")
	router := SetupRouter(logger)
	
	// Initialize MongoDB for testing if MONGO_URI is available
	if mongoURI := os.Getenv("MONGO_URI"); mongoURI != "" {
		// Initialize MongoDB collections for testing
		client, err := mongo.Connect(context.Background(), options.Client().ApplyURI(mongoURI))
		if err == nil {
			// Don't disconnect immediately - keep client alive for test duration
			// defer client.Disconnect(context.Background())
			
			// Initialize packages with test database
			dbName := os.Getenv("MONGO_DB_NAME")
			if dbName == "" {
				dbName = "zurabase_test"
			}
			
			notes.Initialize(client, dbName)
			planner.Initialize(client, dbName)
			auth.Initialize(client, dbName)
			models.Initialize(client, dbName)
			
			// Initialize LLM profiles
			models.InitializeLLMProfiles(client, dbName)
		}
	}
	
	return router
}

// setupGinRoutes sets up all routes directly with Gin
func setupGinRoutes(router *gin.Engine) {
	// Health check routes
	router.GET("/health", healthCheckHandler)
	router.GET("/api/health", healthCheckHandler)

	// Authentication routes
	router.GET("/api/auth/google", ginAuthGoogleLoginHandler)
	router.GET("/auth/google", ginAuthGoogleLoginHandler)
	router.GET("/api/auth/google/callback", ginAuthGoogleCallbackHandler)
	router.GET("/auth/google/callback", ginAuthGoogleCallbackHandler)
	router.GET("/api/auth/user", auth.GinAuthMiddleware(), ginAuthUserHandler)
	router.GET("/auth/user", auth.GinAuthMiddleware(), ginAuthUserHandler)
	router.POST("/api/auth/logout", ginAuthLogoutHandler)
	router.POST("/auth/logout", ginAuthLogoutHandler)

	// Notes routes with optional authentication
	notesGroup := router.Group("/api/note")
	notesGroup.Use(auth.GinOptionalAuthMiddleware())
	{
		notesGroup.Any("", ginNotesHandler)
		notesGroup.Any("/*path", ginNotesHandler)
	}

	notesGroup2 := router.Group("/note")
	notesGroup2.Use(auth.GinOptionalAuthMiddleware())
	{
		notesGroup2.Any("", ginNotesHandler)
		notesGroup2.Any("/*path", ginNotesHandler)
	}

	router.GET("/api/notes", auth.GinOptionalAuthMiddleware(), ginListNotesHandler)
	router.GET("/notes", auth.GinOptionalAuthMiddleware(), ginListNotesHandler)

	// Planner routes with optional authentication
	plannerGroup := router.Group("/api/planner")
	plannerGroup.Use(auth.GinOptionalAuthMiddleware())
	{
		plannerGroup.GET("/list", ginPlannerListHandler)
		plannerGroup.POST("", ginPlannerCreateHandler)
		plannerGroup.GET("/templates", ginPlannerTemplatesHandler)
		plannerGroup.GET("/templates/:id", ginPlannerTemplateHandler)
		plannerGroup.POST("/import", ginPlannerImportHandler)
		plannerGroup.GET("/:id/export", ginPlannerExportHandler)
		plannerGroup.POST("/:id/lanes/reorder", ginPlannerReorderLanesHandler)
		plannerGroup.POST("/:id/lane/:laneId/cards/reorder", ginPlannerReorderCardsHandler)
		plannerGroup.POST("/:id/lane/:laneId/split", ginPlannerSplitLaneHandler)
		plannerGroup.POST("/:id/lane/:laneId/card", ginPlannerAddCardHandler)
		plannerGroup.GET("/:id/lane/:laneId/card/:cardId", ginPlannerGetCardHandler)
		plannerGroup.PUT("/:id/lane/:laneId/card/:cardId", ginPlannerUpdateCardHandler)
		plannerGroup.DELETE("/:id/lane/:laneId/card/:cardId", ginPlannerDeleteCardHandler)
		plannerGroup.POST("/:id/card/:cardId/move", ginPlannerMoveCardHandler)
		plannerGroup.POST("/:id/lane", ginPlannerAddLaneHandler)
		plannerGroup.PUT("/:id/lane/:laneId", ginPlannerUpdateLaneHandler)
		plannerGroup.DELETE("/:id/lane/:laneId", ginPlannerDeleteLaneHandler)
		plannerGroup.GET("/:id", ginPlannerGetHandler)
		plannerGroup.PUT("/:id", ginPlannerUpdateHandler)
		plannerGroup.DELETE("/:id", ginPlannerDeleteHandler)
	}

	plannerGroup2 := router.Group("/planner")
	plannerGroup2.Use(auth.GinOptionalAuthMiddleware())
	{
		plannerGroup2.GET("/list", ginPlannerListHandler)
		plannerGroup2.POST("", ginPlannerCreateHandler)
		plannerGroup2.GET("/templates", ginPlannerTemplatesHandler)
		plannerGroup2.GET("/templates/:id", ginPlannerTemplateHandler)
		plannerGroup2.POST("/import", ginPlannerImportHandler)
		plannerGroup2.GET("/:id/export", ginPlannerExportHandler)
		plannerGroup2.POST("/:id/lanes/reorder", ginPlannerReorderLanesHandler)
		plannerGroup2.POST("/:id/lane/:laneId/cards/reorder", ginPlannerReorderCardsHandler)
		plannerGroup2.POST("/:id/lane/:laneId/split", ginPlannerSplitLaneHandler)
		plannerGroup2.POST("/:id/lane/:laneId/card", ginPlannerAddCardHandler)
		plannerGroup2.GET("/:id/lane/:laneId/card/:cardId", ginPlannerGetCardHandler)
		plannerGroup2.PUT("/:id/lane/:laneId/card/:cardId", ginPlannerUpdateCardHandler)
		plannerGroup2.DELETE("/:id/lane/:laneId/card/:cardId", ginPlannerDeleteCardHandler)
		plannerGroup2.POST("/:id/card/:cardId/move", ginPlannerMoveCardHandler)
		plannerGroup2.POST("/:id/lane", ginPlannerAddLaneHandler)
		plannerGroup2.PUT("/:id/lane/:laneId", ginPlannerUpdateLaneHandler)
		plannerGroup2.DELETE("/:id/lane/:laneId", ginPlannerDeleteLaneHandler)
		plannerGroup2.GET("/:id", ginPlannerGetHandler)
		plannerGroup2.PUT("/:id", ginPlannerUpdateHandler)
		plannerGroup2.DELETE("/:id", ginPlannerDeleteHandler)
	}

	// Image search routes
	router.GET("/api/images/:query", ginImageSearchHandler)
	router.GET("/images/:query", ginImageSearchHandler)
	// Handle empty query case
	router.GET("/api/images/", ginImageSearchEmptyHandler)
	router.GET("/images/", ginImageSearchEmptyHandler)

	// Strands routes with authentication
	strandsGroup := router.Group("/api/strands")
	strandsGroup.Use(auth.GinAuthMiddleware())
	{
		strandsGroup.Any("", ginStrandsHandler)
		strandsGroup.Any("/*path", ginStrandsHandler)
	}

	strandsGroup2 := router.Group("/strands")
	strandsGroup2.Use(auth.GinAuthMiddleware())
	{
		strandsGroup2.Any("", ginStrandsHandler)
		strandsGroup2.Any("/*path", ginStrandsHandler)
	}

	// WhatsApp webhook (no authentication required) - separate from strands
	router.POST("/api/whatsapp", ginWhatsAppWebhookHandler)
	router.POST("/whatsapp", ginWhatsAppWebhookHandler)

	// LLM Profiles routes with authentication
	llmProfilesGroup := router.Group("/api/llm-profiles")
	llmProfilesGroup.Use(auth.GinAuthMiddleware())
	{
		llmProfilesGroup.GET("", ginLLMProfilesHandler)
		llmProfilesGroup.POST("", ginLLMCreateProfileHandler)
		llmProfilesGroup.POST("/test-connection", ginLLMTestConnectionHandler)
		llmProfilesGroup.GET("/models", ginLLMListModelsHandler)
		llmProfilesGroup.GET("/:id", ginLLMProfileHandler)
		llmProfilesGroup.PUT("/:id", ginLLMProfileUpdateHandler)
		llmProfilesGroup.DELETE("/:id", ginLLMProfileDeleteHandler)
		llmProfilesGroup.PUT("/:id/set-default", ginLLMProfileSetDefaultHandler)
		llmProfilesGroup.POST("/:id/test-stored-connection", ginLLMProfileTestStoredConnectionHandler)
	}

	llmProfilesGroup2 := router.Group("/llm-profiles")
	llmProfilesGroup2.Use(auth.GinAuthMiddleware())
	{
		llmProfilesGroup2.GET("", ginLLMProfilesHandler)
		llmProfilesGroup2.POST("", ginLLMCreateProfileHandler)
		llmProfilesGroup2.POST("/test-connection", ginLLMTestConnectionHandler)
		llmProfilesGroup2.GET("/models", ginLLMListModelsHandler)
		llmProfilesGroup2.GET("/:id", ginLLMProfileHandler)
		llmProfilesGroup2.PUT("/:id", ginLLMProfileUpdateHandler)
		llmProfilesGroup2.DELETE("/:id", ginLLMProfileDeleteHandler)
		llmProfilesGroup2.PUT("/:id/set-default", ginLLMProfileSetDefaultHandler)
		llmProfilesGroup2.POST("/:id/test-stored-connection", ginLLMProfileTestStoredConnectionHandler)
	}

	// Log ingestion endpoint with optional authentication
	router.POST("/api/logs", auth.GinOptionalAuthMiddleware(), ginLogsHandler)
	router.POST("/logs", auth.GinOptionalAuthMiddleware(), ginLogsHandler)
}

// HealthCheckResponse represents the response from the health check endpoint
type HealthCheckResponse struct {
	Status string `json:"status"`
	Error  string `json:"error,omitempty"`
}

// HealthCheck checks if the MongoDB connection is healthy
func HealthCheck(ctx context.Context) (*HealthCheckResponse, error) {
	// This would normally check MongoDB connection
	// For now, return healthy status
	return &HealthCheckResponse{Status: "healthy"}, nil
}

// healthCheckHandler handles health check requests
func healthCheckHandler(c *gin.Context) {
	ctx := c.Request.Context()
	response, err := HealthCheck(ctx)

	if err != nil {
		c.JSON(http.StatusInternalServerError, response)
		return
	}

	c.JSON(http.StatusOK, response)
}

// Gin handler functions that wrap existing HTTP handlers
func ginAuthUserHandler(c *gin.Context) {
	// Extract user_id from Gin context (set by GinAuthMiddleware)
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Unauthorized"})
		return
	}

	user, err := auth.GetUserByID(c.Request.Context(), userID.(string))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, user)
}

func ginNotesHandler(c *gin.Context) {
	notes.HandleNoteRequest(c.Writer, copyUserContextToRequest(c))
}

func ginListNotesHandler(c *gin.Context) {
	notes.HandleListNotes(c.Writer, copyUserContextToRequest(c))
}

func ginStrandsHandler(c *gin.Context) {
	strands.HandleStrandsRequest(c.Writer, copyUserContextToRequest(c))
}

func ginImageSearchHandler(c *gin.Context) {
	query := c.Param("query")
	if query == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Query parameter is required"})
		return
	}

	photos, err := pexels.SearchPhoto(c.Request.Context(), query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, photos)
}

func ginImageSearchEmptyHandler(c *gin.Context) {
	c.JSON(http.StatusBadRequest, gin.H{"error": "Query parameter is required"})
}

// LLM Profile handlers
func ginLLMProfileHandler(c *gin.Context) {
	id := c.Param("id")
	llm_profiles.HandleGetLLMProfile(c.Writer, c.Request, id)
}

func ginLLMProfileUpdateHandler(c *gin.Context) {
	id := c.Param("id")
	llm_profiles.HandleUpdateLLMProfile(c.Writer, c.Request, id)
}

func ginLLMProfileDeleteHandler(c *gin.Context) {
	id := c.Param("id")
	llm_profiles.HandleDeleteLLMProfile(c.Writer, c.Request, id)
}

func ginLLMProfileSetDefaultHandler(c *gin.Context) {
	id := c.Param("id")
	llm_profiles.HandleSetDefaultLLMProfile(c.Writer, c.Request, id)
}

func ginLLMProfileTestStoredConnectionHandler(c *gin.Context) {
	id := c.Param("id")
	llm_profiles.HandleTestStoredLLMConnection(c.Writer, c.Request, id)
}

// Authentication handlers
func ginAuthGoogleLoginHandler(c *gin.Context) {
	auth.HandleGoogleLogin(c.Writer, c.Request)
}

func ginAuthGoogleCallbackHandler(c *gin.Context) {
	auth.HandleGoogleCallback(c.Writer, c.Request)
}

func ginAuthLogoutHandler(c *gin.Context) {
	auth.HandleLogout(c.Writer, c.Request)
}

// Helper function to copy user context from Gin to request
func copyUserContextToRequest(c *gin.Context) *http.Request {
	req := c.Request
	if userID, exists := c.Get("user_id"); exists {
		ctx := context.WithValue(req.Context(), "user_id", userID)
		req = req.WithContext(ctx)
	}
	if email, exists := c.Get("email"); exists {
		ctx := context.WithValue(req.Context(), "email", email)
		req = req.WithContext(ctx)
	}
	return req
}

// Planner handlers
func ginPlannerListHandler(c *gin.Context) {
	planner.HandleListPlanners(c.Writer, copyUserContextToRequest(c))
}

func ginPlannerCreateHandler(c *gin.Context) {
	planner.HandleCreatePlanner(c.Writer, copyUserContextToRequest(c))
}

func ginPlannerTemplatesHandler(c *gin.Context) {
	planner.HandleGetTemplates(c.Writer, copyUserContextToRequest(c))
}

func ginPlannerTemplateHandler(c *gin.Context) {
	planner.HandleGetTemplate(c.Writer, copyUserContextToRequest(c))
}

func ginPlannerImportHandler(c *gin.Context) {
	planner.HandleImportPlannerMarkdown(c.Writer, copyUserContextToRequest(c))
}

func ginPlannerExportHandler(c *gin.Context) {
	planner.HandleExportPlannerMarkdown(c.Writer, copyUserContextToRequest(c))
}

func ginPlannerReorderLanesHandler(c *gin.Context) {
	planner.HandleReorderLanes(c.Writer, copyUserContextToRequest(c))
}

func ginPlannerReorderCardsHandler(c *gin.Context) {
	planner.HandleReorderCards(c.Writer, copyUserContextToRequest(c))
}

func ginPlannerSplitLaneHandler(c *gin.Context) {
	planner.HandleSplitLane(c.Writer, copyUserContextToRequest(c))
}

func ginPlannerAddCardHandler(c *gin.Context) {
	planner.HandleAddCard(c.Writer, copyUserContextToRequest(c))
}

func ginPlannerGetCardHandler(c *gin.Context) {
	planner.HandleGetCard(c.Writer, copyUserContextToRequest(c))
}

func ginPlannerUpdateCardHandler(c *gin.Context) {
	planner.HandleUpdateCard(c.Writer, copyUserContextToRequest(c))
}

func ginPlannerDeleteCardHandler(c *gin.Context) {
	planner.HandleDeleteCard(c.Writer, copyUserContextToRequest(c))
}

func ginPlannerMoveCardHandler(c *gin.Context) {
	planner.HandleMoveCard(c.Writer, copyUserContextToRequest(c))
}

func ginPlannerAddLaneHandler(c *gin.Context) {
	planner.HandleAddLane(c.Writer, copyUserContextToRequest(c))
}

func ginPlannerUpdateLaneHandler(c *gin.Context) {
	planner.HandleUpdateLane(c.Writer, copyUserContextToRequest(c))
}

func ginPlannerDeleteLaneHandler(c *gin.Context) {
	planner.HandleDeleteLane(c.Writer, copyUserContextToRequest(c))
}

func ginPlannerGetHandler(c *gin.Context) {
	planner.HandleGetPlanner(c.Writer, copyUserContextToRequest(c))
}

func ginPlannerUpdateHandler(c *gin.Context) {
	planner.HandleUpdatePlanner(c.Writer, copyUserContextToRequest(c))
}

func ginPlannerDeleteHandler(c *gin.Context) {
	planner.HandleDeletePlanner(c.Writer, copyUserContextToRequest(c))
}

// LLM Profiles handlers
func ginLLMProfilesHandler(c *gin.Context) {
	llm_profiles.HandleGetLLMProfiles(c.Writer, copyUserContextToRequest(c))
}

func ginLLMCreateProfileHandler(c *gin.Context) {
	llm_profiles.HandleCreateLLMProfile(c.Writer, copyUserContextToRequest(c))
}

func ginLLMTestConnectionHandler(c *gin.Context) {
	llm_profiles.HandleTestLLMConnection(c.Writer, copyUserContextToRequest(c))
}

func ginLLMListModelsHandler(c *gin.Context) {
	llm_profiles.HandleListAvailableModels(c.Writer, copyUserContextToRequest(c))
}

// WhatsApp webhook handler
func ginWhatsAppWebhookHandler(c *gin.Context) {
	strands.HandleWhatsAppWebhook(c.Writer, c.Request)
}

// Logs handler
func ginLogsHandler(c *gin.Context) {
	logs.HandleLogIngestion(c.Writer, copyUserContextToRequest(c))
}
