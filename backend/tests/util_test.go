package tests

import "os"

var apiEndpoint = func() string {
	// Check if we're running in Docker
	if os.Getenv("DOCKER_ENV") == "true" {
		return "http://backend:8080"
	}
	
	// Otherwise use the API_ENDPOINT
	v := os.Getenv("API_ENDPOINT")
	if v == "" {
		panic("API_ENDPOINT environment variable must be set for integration tests")
	}
	return v
}()
