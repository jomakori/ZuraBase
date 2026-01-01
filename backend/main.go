package main

import (
	"context"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	"zurabase/api/notes"
	"zurabase/api/planner"
	"zurabase/api/strands"
	"zurabase/internal/auth"
	"zurabase/internal/logs"
	"zurabase/internal/models"
	"zurabase/internal/server"
	"zurabase/internal/services"
)

var mongoClient *mongo.Client

// HealthCheckResponse represents the response from the health check endpoint
type HealthCheckResponse struct {
	Status string `json:"status"`
	Error  string `json:"error,omitempty"`
}

// HealthCheck checks if the MongoDB connection is healthy
func HealthCheck(ctx context.Context) (*HealthCheckResponse, error) {
	if err := mongoClient.Ping(ctx, nil); err != nil {
		return &HealthCheckResponse{Status: "unhealthy", Error: "MongoDB connection failed"}, err
	}
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

// setupRouter creates and configures the Gin router with all middleware and routes
// The setupRouter function will be moved to backend/server/router.go and exposed as SetupRouter.

// The registerGinRoutes function will be moved to backend/server/router.go.

func main() {
	// Initialize structured logger
	logger := services.NewLogger("main")
	defer logger.Sync()

	// Validate required environment variables
	requiredEnvVars := []string{"MONGO_URI", "UI_ENDPOINT"}
	for _, envVar := range requiredEnvVars {
		if os.Getenv(envVar) == "" {
			logger.Error("Required environment variable is not set",
				services.String("variable", envVar))
			logger.Fatal("Application startup failed due to missing environment variable",
				services.String("variable", envVar))
		}
	}

	logger.Info("Starting ZuraBase backend server initialization")

	// Connect to MongoDB
	var err error
	mongoClient, err = mongo.Connect(context.Background(), options.Client().ApplyURI(os.Getenv("MONGO_URI")))
	if err != nil {
		logger.Error("Failed to connect to MongoDB", services.Error(err))
		logger.Fatal("Application startup failed due to MongoDB connection error", services.Error(err))
	}
	defer mongoClient.Disconnect(context.Background())

	logger.Info("Successfully connected to MongoDB")

	// Initialize packages
	// Initialize MongoDB collections safely
	if mongoClient == nil {
		logger.Fatal("MongoDB client is nil — initialization aborted")
	}

	notes.Initialize(mongoClient, "zurabase")
	planner.Initialize(mongoClient, "zurabase")
	auth.Initialize(mongoClient, "zurabase")
	models.Initialize(mongoClient, "zurabase")

	// Initialize LLM profiles
	if err := models.InitializeLLMProfiles(mongoClient, "zurabase"); err != nil {
		logger.Warn("LLM profiles initialization error", services.Error(err))
	} else {
		logger.Info("LLM profiles initialized successfully")
	}

	logger.Info("MongoDB models initialized successfully")

	// Initialize logs module
	if err := logs.Initialize(); err != nil {
		logger.Warn("Logs initialization error", services.Error(err))
	} else {
		logger.Info("Logs module initialized successfully")
	}

	// Initialize strands module (AI + Tag Service)
	if err := strands.Initialize(); err != nil {
		logger.Warn("Strands initialization error", services.Error(err))
	} else {
		logger.Info("Strands module initialized successfully")
	}

	// Initialize persistent WhatsApp connection
	ctx := context.Background()
	if err := strands.InitializeWhatsApp(ctx); err != nil {
		logger.Warn("WhatsApp initialization failed", services.Error(err))
	} else {
		logger.Info("WhatsApp integration initialized successfully")
	}

	if err := planner.InitializeTemplates(context.Background()); err != nil {
		logger.Error("Failed to initialize planner templates", services.Error(err))
		logger.Fatal("Application startup failed due to planner templates initialization error", services.Error(err))
	}

	// Setup Gin router
	// Ensure all MongoDB collections are initialized before starting the router
	logger.Info("Verifying MongoDB collection initialization")
	if mongoClient == nil {
		logger.Fatal("MongoDB client is nil before router setup")
	}

	router := server.SetupRouter(logger)

	// Start server
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	logger.Info("Starting server",
		services.String("port", port),
		services.String("environment", os.Getenv("ENVIRONMENT")))

	if err := router.Run(":" + port); err != nil {
		logger.Error("Server failed to start", services.Error(err))
		logger.Fatal("Server failed to start", services.Error(err))
	}
}
