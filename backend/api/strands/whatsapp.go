package strands

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"

	"zurabase/internal/services"
	"zurabase/models"

	"github.com/google/uuid"
)

// WhatsAppMessage represents the structure of a message from WhatsApp
type WhatsAppMessage struct {
	Object string `json:"object"`
	Entry  []struct {
		ID      string `json:"id"`
		Changes []struct {
			Value struct {
				MessagingProduct string `json:"messaging_product"`
				Metadata         struct {
					DisplayPhoneNumber string `json:"display_phone_number"`
					PhoneNumberID      string `json:"phone_number_id"`
				} `json:"metadata"`
				Contacts []struct {
					Profile struct {
						Name string `json:"name"`
					} `json:"profile"`
					WaID string `json:"wa_id"`
				} `json:"contacts"`
				Messages []struct {
					From      string `json:"from"`
					ID        string `json:"id"`
					Timestamp string `json:"timestamp"`
					Type      string `json:"type"`
					Text      struct {
						Body string `json:"body"`
					} `json:"text,omitempty"`
					Image struct {
						MimeType string `json:"mime_type"`
						SHA256   string `json:"sha256"`
						ID       string `json:"id"`
					} `json:"image,omitempty"`
					Voice struct {
						MimeType string `json:"mime_type"`
						SHA256   string `json:"sha256"`
						ID       string `json:"id"`
					} `json:"voice,omitempty"`
				} `json:"messages"`
			} `json:"value"`
		} `json:"changes"`
	} `json:"entry"`
}

// WhatsAppMediaResponse represents the response when requesting media from WhatsApp
type WhatsAppMediaResponse struct {
	URL      string `json:"url"`
	MimeType string `json:"mime_type"`
	SHA256   string `json:"sha256"`
	FileSize int    `json:"file_size"`
	ID       string `json:"id"`
}

// HandleWhatsAppWebhook processes incoming webhook requests from WhatsApp
func HandleWhatsAppWebhook(w http.ResponseWriter, r *http.Request) {
	// Verify request method
	if r.Method == http.MethodGet {
		handleWhatsAppVerification(w, r)
		return
	}

	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Read and parse the request body
	body, err := io.ReadAll(r.Body)
	if err != nil {
		log.Printf("Error reading WhatsApp webhook body: %v", err)
		http.Error(w, "Error reading request body", http.StatusBadRequest)
		return
	}

	var message WhatsAppMessage
	if err := json.Unmarshal(body, &message); err != nil {
		log.Printf("Error parsing WhatsApp webhook JSON: %v", err)
		http.Error(w, "Error parsing JSON", http.StatusBadRequest)
		return
	}

	// Process the message asynchronously
	go processWhatsAppMessage(r.Context(), message)

	// Respond with success to acknowledge receipt
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(`{"status": "received"}`))
}

// handleWhatsAppVerification handles the verification request from WhatsApp
func handleWhatsAppVerification(w http.ResponseWriter, r *http.Request) {
	// Get the verification token from the environment
	verifyToken := os.Getenv("WHATSAPP_VERIFY_TOKEN")
	if verifyToken == "" {
		log.Printf("WHATSAPP_VERIFY_TOKEN environment variable is not set")
		http.Error(w, "Configuration error", http.StatusInternalServerError)
		return
	}

	// Get the challenge and token from the query parameters
	challenge := r.URL.Query().Get("hub.challenge")
	mode := r.URL.Query().Get("hub.mode")
	token := r.URL.Query().Get("hub.verify_token")

	// Verify the token and respond with the challenge
	if mode == "subscribe" && token == verifyToken {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(challenge))
		return
	}

	// If verification fails, respond with forbidden
	http.Error(w, "Verification failed", http.StatusForbidden)
}

// processWhatsAppMessage processes a message from WhatsApp and creates a strand
func processWhatsAppMessage(ctx context.Context, message WhatsAppMessage) {
	// Initialize services
	aiClient, err := services.NewAIClient()
	if err != nil {
		log.Printf("Error creating AI client: %v", err)
		return
	}
	tagService := services.NewTagService(aiClient)

	// Process each message in the webhook
	for _, entry := range message.Entry {
		for _, change := range entry.Changes {
			for _, msg := range change.Value.Messages {
				// Extract user ID from the WhatsApp ID
				// In a real implementation, you would map this to your user system
				userID := msg.From

				// Process based on message type
				var content string
				var mediaType string

				switch msg.Type {
				case "text":
					content = msg.Text.Body
					mediaType = "text"
				case "image":
					// In a real implementation, you would download the image
					// and possibly use OCR or image analysis
					content = fmt.Sprintf("Image received with ID: %s", msg.Image.ID)
					mediaType = "image"
				case "voice":
					// In a real implementation, you would download the voice message
					// and possibly use speech-to-text
					content = fmt.Sprintf("Voice message received with ID: %s", msg.Voice.ID)
					mediaType = "voice"
				default:
					log.Printf("Unsupported message type: %s", msg.Type)
					continue
				}

				// Create a new strand
				strand := &models.Strand{
					ID:        uuid.New().String(),
					UserID:    userID,
					Content:   content,
					Source:    "whatsapp",
					Tags:      []string{"whatsapp", mediaType},
					CreatedAt: time.Now(),
					UpdatedAt: time.Now(),
				}

				// Enrich with AI if it's text content
				if mediaType == "text" {
					tags, summary, err := tagService.ExtractTagsFromContent(ctx, content, "whatsapp")
					if err != nil {
						log.Printf("Error extracting tags: %v", err)
					} else {
						// Merge AI-generated tags with default tags
						strand.Tags = tagService.MergeTags(strand.Tags, tags)
						strand.Summary = summary
					}
				}

				// Save the strand
				_, err := models.SaveStrand(ctx, strand)
				if err != nil {
					log.Printf("Error saving strand: %v", err)
				} else {
					log.Printf("Successfully created strand from WhatsApp message: %s", strand.ID)
				}
			}
		}
	}
}

// downloadWhatsAppMedia downloads media from WhatsApp (image, voice, etc.)
// This is a placeholder implementation - in a real system, you would use the WhatsApp API
func downloadWhatsAppMedia(mediaID string) ([]byte, string, error) {
	// In a real implementation, you would:
	// 1. Get the media URL from WhatsApp API
	// 2. Download the media using the URL
	// 3. Return the media content and type

	// This is a placeholder
	return []byte("Media content placeholder"), "text/plain", nil
}
