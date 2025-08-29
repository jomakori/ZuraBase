package main

import "os"

var apiEndpoint = func() string {
	v := os.Getenv("VITE_API_ENDPOINT")
	if v == "" {
		panic("VITE_API_ENDPOINT environment variable must be set for integration tests")
	}
	return v
}()
