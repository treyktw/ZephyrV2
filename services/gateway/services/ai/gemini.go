// gemini.go
package services

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gorilla/websocket"
)

type GeminiRequest struct {
	Contents []struct {
		Parts []struct {
			Text string `json:"text"`
		} `json:"parts"`
	} `json:"contents"`
	GenerationConfig struct {
		Temperature     float64 `json:"temperature"`
		TopK            int     `json:"topK"`
		TopP            float64 `json:"topP"`
		MaxOutputTokens int     `json:"maxOutputTokens"`
	} `json:"generationConfig"`
}

type GeminiResponse struct {
	Candidates []struct {
		Content struct {
			Parts []struct {
				Text string `json:"text"`
			} `json:"parts"`
		} `json:"content"`
	} `json:"candidates"`
}

type WebSocketMessage struct {
	Type      string `json:"type"`
	Content   string `json:"content"`
	MessageId string `json:"messageId,omitempty"`
}

func StreamGeminiResponse(conn *websocket.Conn, content string) {
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		log.Printf("GEMINI_API_KEY not set")
		return
	}

	// Generate a unique message ID for this response
	messageId := fmt.Sprintf("%d", time.Now().UnixNano())

	// Send start message
	startMsg := WebSocketMessage{
		Type:      "start",
		MessageId: messageId,
	}
	if err := conn.WriteJSON(startMsg); err != nil {
		log.Printf("Error sending start message: %v", err)
		return
	}

	// Prepare Gemini request
	reqBody := GeminiRequest{
		Contents: []struct {
			Parts []struct {
				Text string `json:"text"`
			} `json:"parts"`
		}{
			{
				Parts: []struct {
					Text string `json:"text"`
				}{
					{Text: content},
				},
			},
		},
		GenerationConfig: struct {
			Temperature     float64 `json:"temperature"`
			TopK            int     `json:"topK"`
			TopP            float64 `json:"topP"`
			MaxOutputTokens int     `json:"maxOutputTokens"`
		}{
			Temperature:     0.7,
			TopK:            40,
			TopP:            0.95,
			MaxOutputTokens: 2048,
		},
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		log.Printf("Error marshaling request: %v", err)
		return
	}

	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=%s", apiKey)
	resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		log.Printf("Error making request to Gemini: %v", err)
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("Error reading response: %v", err)
		return
	}

	var geminiResp GeminiResponse
	if err := json.Unmarshal(body, &geminiResp); err != nil {
		log.Printf("Error unmarshaling response: %v", err)
		return
	}

	if len(geminiResp.Candidates) > 0 && len(geminiResp.Candidates[0].Content.Parts) > 0 {
		text := geminiResp.Candidates[0].Content.Parts[0].Text

		// Stream character by character for a more natural typing effect
		for _, char := range text {
			token := WebSocketMessage{
				Type:      "token",
				Content:   string(char),
				MessageId: messageId,
			}

			if err := conn.WriteJSON(token); err != nil {
				log.Printf("Error writing token: %v", err)
				return
			}

			// Add a small delay between characters
			// Adjust the duration to control typing speed
			time.Sleep(time.Millisecond * 20) // 20ms delay between characters
		}

		// Send completion message
		completion := WebSocketMessage{
			Type:      "complete",
			MessageId: messageId,
		}
		if err := conn.WriteJSON(completion); err != nil {
			log.Printf("Error sending completion: %v", err)
		}
	}
}

func GenerateUniqueId() string {
	// Simple implementation - you might want to use a proper UUID library
	return fmt.Sprintf("%d", time.Now().UnixNano())
}

func SplitIntoTokens(text string) []string {
	var tokens []string
	var currentToken []rune

	for _, char := range text {
		currentToken = append(currentToken, char)

		// Split on word boundaries
		if char == ' ' || char == '.' || char == ',' || char == '!' || char == '?' || char == '\n' {
			if len(currentToken) > 0 {
				tokens = append(tokens, string(currentToken))
				currentToken = []rune{}
			}
		}
	}

	if len(currentToken) > 0 {
		tokens = append(tokens, string(currentToken))
	}

	return tokens
}

func splitIntoTokens(text string) []string {
	var tokens []string
	var currentToken []rune

	for _, char := range text {
		currentToken = append(currentToken, char)

		if char == ' ' || char == '.' || char == ',' || char == '!' || char == '?' || char == '\n' {
			if len(currentToken) > 0 {
				tokens = append(tokens, string(currentToken))
				currentToken = []rune{}
			}
		}
	}

	if len(currentToken) > 0 {
		tokens = append(tokens, string(currentToken))
	}

	return tokens
}
