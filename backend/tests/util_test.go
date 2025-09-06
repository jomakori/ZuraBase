package main

import "os"

var apiEndpoint = func() string {
	// Check if we're running in Docker
	if os.Getenv("DOCKER_ENV") == "true" {
		return "http://backend:8080"
	}
	
	// Otherwise use the VITE_API_ENDPOINT
	v := os.Getenv("VITE_API_ENDPOINT")
	if v == "" {
		panic("VITE_API_ENDPOINT environment variable must be set for integration tests")
	}
	return v
}()
