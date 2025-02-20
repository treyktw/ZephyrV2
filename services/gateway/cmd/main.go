package main

import (
	"encoding/json"
	"flag"
	"log"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
)

var (
	addr     = flag.String("addr", ":8000", "WebSocket server address")
	apiKey   = flag.String("api-key", "AIzaSyA4graOsRcW2FjLXWjkYnj5AzmUXpU0wzA", "Gemini API key")
	upgrader = websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true
		},
		HandshakeTimeout: 10 * time.Second,
	}
)

type Message struct {
	Type      string         `json:"type"`
	Content   string         `json:"content"`
	MessageID string         `json:"message_id,omitempty"`
	Metadata  map[string]any `json:"metadata,omitempty"`
}

func handleWebSocket(w http.ResponseWriter, r *http.Request) {
	// Upgrade connection
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Upgrade failed: %v", err)
		return
	}
	defer conn.Close()

	log.Printf("New WebSocket connection from %s", r.RemoteAddr)

	// Set read deadline to handle stale connections
	conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	conn.SetPongHandler(func(string) error {
		conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	// Read messages
	for {
		_, rawMessage, err := conn.ReadMessage()
		if err != nil {
			log.Printf("Read error: %v", err)
			break
		}

		var message Message
		if err := json.Unmarshal(rawMessage, &message); err != nil {
			log.Printf("JSON decode error: %v", err)
			continue
		}

		log.Printf("Received message: %+v", message)

		// Handle chat message
		if message.Type == "chat" {
			// Send response immediately as test
			response := Message{
				Type:      "token",
				Content:   "Hello! Processing your message: " + message.Content,
				MessageID: message.MessageID,
			}

			if err := conn.WriteJSON(response); err != nil {
				log.Printf("Write error: %v", err)
				break
			}

			// Send completion message
			complete := Message{
				Type:      "complete",
				MessageID: message.MessageID,
			}

			if err := conn.WriteJSON(complete); err != nil {
				log.Printf("Write error: %v", err)
				break
			}
		}
	}
}

func main() {
	flag.Parse()

	if *apiKey == "" {
		log.Fatal("API key is required")
	}

	http.HandleFunc("/chat", handleWebSocket)

	log.Printf("WebSocket server starting on %s", *addr)
	if err := http.ListenAndServe(*addr, nil); err != nil {
		log.Fatal("ListenAndServe:", err)
	}
}
