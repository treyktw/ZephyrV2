package main

import (
	"log"
	"os"
)

func main() {
	log.Println("Starting ZephyrV2 API Gateway")
	if err := run(); err != nil {
		log.Printf("Error: %v\n", err)
		os.Exit(1)
	}
}

func run() error {
	// TODO: Initialize server
	return nil
}
