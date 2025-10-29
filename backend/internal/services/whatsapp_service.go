package services

import (
	"context"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sync"

	_ "github.com/mattn/go-sqlite3"
	"go.mau.fi/whatsmeow"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types/events"

	"go.mau.fi/whatsmeow/binary/proto"
	"go.mau.fi/whatsmeow/types"
)

// WhatsAppService is a lightweight wrapper for go-whatsapp-web-multidevice
type WhatsAppService struct {
	client *whatsmeow.Client
	mu     sync.Mutex
}

// NewWhatsAppService creates and initializes a WhatsApp client.
func NewWhatsAppService(ctx context.Context) (*WhatsAppService, error) {
	sessionDir := "sessions"
	if err := os.MkdirAll(sessionDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create session directory: %w", err)
	}

	sessionFile := filepath.Join(sessionDir, "whatsapp_session.gob")
	container, err := sqlstore.New("sqlite3", fmt.Sprintf("file:%s?_foreign_keys=on", sessionFile), nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create store: %w", err)
	}

	device, err := container.GetFirstDevice()
	if err != nil {
		return nil, fmt.Errorf("failed to load device: %w", err)
	}

	client := whatsmeow.NewClient(device, nil)

	service := &WhatsAppService{client: client}
	go service.listen(ctx)

	log.Println("✅ WhatsApp service initialized")
	return service, nil
}

// SendTextMessage sends a text message to a given WhatsApp number.
func (w *WhatsAppService) SendTextMessage(to, message string) error {
	// WhatsApp requires no context in current client SendMessage signature
	w.mu.Lock()
	defer w.mu.Unlock()

	if w.client == nil {
		return fmt.Errorf("whatsapp client not initialized")
	}

	msg := &proto.Message{
		Conversation: &message,
	}

	toJID := types.NewJID(to, types.DefaultUserServer)
	msgID := whatsmeow.GenerateMessageID()
	_, err := w.client.SendMessage(toJID, msgID, msg)
	if err != nil {
		return fmt.Errorf("failed to send message: %w", err)
	}

	log.Printf("📤 Sent WhatsApp message to %s: %s", to, message)
	return nil
}

// AddHandler registers a custom event handler for incoming messages.
func (w *WhatsAppService) AddHandler(handler func(from, text string)) {
	if w.client == nil {
		return
	}

	w.client.AddEventHandler(func(evt any) {
		switch v := evt.(type) {
		case *events.Message:
			if v.Info.IsFromMe {
				return
			}
			text := v.Message.GetConversation()
			from := v.Info.Sender.String()
			handler(from, text)
		}
	})
}

// listen handles automatic connection events
func (w *WhatsAppService) listen(ctx context.Context) {
	w.client.AddEventHandler(func(evt any) {
		switch evt.(type) {
		case *events.Connected, *events.PairSuccess:
			log.Println("🟢 WhatsApp connected")
		case *events.Disconnected:
			log.Println("🔴 WhatsApp disconnected")
		case *events.LoggedOut:
			log.Println("⚠️ WhatsApp session expired. Please re-login.")
		default:
		}
	})

	err := w.client.Connect()
	if err != nil {
		log.Printf("Error connecting to WhatsApp: %v", err)
	}
	log.Println("WhatsApp client running...")

	<-ctx.Done()
	log.Println("WhatsApp service shutting down")
	w.client.Disconnect()
}
