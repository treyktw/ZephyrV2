// gemini.go
package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"sync"
	"time"

	"golang.org/x/net/websocket"
)

type Message struct {
	Type    string `json:"type"`
	Content string `json:"content"`
}

type Connection struct {
	conn *websocket.Conn
	mu   sync.Mutex
}

func (c *Connection) WriteJSON(v interface{}) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	return websocket.JSON.Send(c.conn, v)
}

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

func StreamGeminiResponse(conn *Connection, content string) {
	apiKey := os.Getenv("GEMINI_API_KEY")
	if apiKey == "" {
		conn.WriteJSON(Message{
			Type:    "error",
			Content: "Gemini API key not configured",
		})
		return
	}

	// Send start message
	conn.WriteJSON(Message{
		Type: "start",
	})

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
		conn.WriteJSON(Message{
			Type:    "error",
			Content: "Error preparing request",
		})
		return
	}

	url := fmt.Sprintf("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=%s", apiKey)
	resp, err := http.Post(url, "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		conn.WriteJSON(Message{
			Type:    "error",
			Content: "Error connecting to Gemini API",
		})
		return
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		conn.WriteJSON(Message{
			Type:    "error",
			Content: "Error reading response",
		})
		return
	}

	var geminiResp GeminiResponse
	if err := json.Unmarshal(body, &geminiResp); err != nil {
		conn.WriteJSON(Message{
			Type:    "error",
			Content: "Error processing response",
		})
		return
	}

	if len(geminiResp.Candidates) > 0 && len(geminiResp.Candidates[0].Content.Parts) > 0 {
		text := geminiResp.Candidates[0].Content.Parts[0].Text
		tokens := splitIntoTokens(text)

		for _, token := range tokens {
			if err := conn.WriteJSON(Message{
				Type:    "stream",
				Content: token,
			}); err != nil {
				log.Printf("Error streaming token: %v", err)
				return
			}
			time.Sleep(time.Millisecond * 20)
		}

		conn.WriteJSON(Message{
			Type: "complete",
		})
	} else {
		conn.WriteJSON(Message{
			Type:    "error",
			Content: "No response from Gemini",
		})
	}
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
