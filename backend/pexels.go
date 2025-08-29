package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"os"
)

// Object that mirrors the response from the Pexels API.
type SearchResponse struct {
	Photos []struct {
		Id  int `json:"id"`
		Src struct {
			Medium    string `json:"medium"`
			Landscape string `json:"landscape"`
		} `json:"src"`
		Alt string `json:"alt"`
	} `json:"photos"`
}

func SearchPhoto(ctx context.Context, query string) (*SearchResponse, error) {
	// Create a new http client to proxy the request to the Pexels API.
	URL := "https://api.pexels.com/v1/search?query=" + url.QueryEscape(query)
	client := &http.Client{}
	req, _ := http.NewRequest("GET", URL, nil)

	// Add authorization header to the req with the API key.
	req.Header.Set("Authorization", os.Getenv("PEXELS_API_KEY"))

	// Make the request, and close the response body when we're done.
	res, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer func() {
		if cerr := res.Body.Close(); cerr != nil {
			log.Printf("Error closing response body: %v", cerr)
		}
	}()

	if res.StatusCode >= 400 {
		return nil, fmt.Errorf("pexels API error: %s", res.Status)
	}

	// Decode the data into the searchResponse struct.
	var searchResponse *SearchResponse
	err = json.NewDecoder(res.Body).Decode(&searchResponse)
	if err != nil {
		return nil, err
	}

	return searchResponse, nil
}
