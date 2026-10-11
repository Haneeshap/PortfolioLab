package main

import (
	"encoding/json"
	"log"
	"net/http"
	"time"
)

func main() {
	simulator := NewMarketSimulator()

	mux := http.NewServeMux()

	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		json.NewEncoder(w).Encode(map[string]string{
			"status":  "UP",
			"service": "market-simulator",
		})
	})

	mux.HandleFunc("GET /prices", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		json.NewEncoder(w).Encode(simulator.GetPrices())
	})

	go func() {
		ticker := time.NewTicker(5 * time.Second)
		defer ticker.Stop()

		for range ticker.C {
			simulator.UpdatePrices()
		}
	}()

	log.Println("Market simulator listening on http://localhost:8081")

	if err := http.ListenAndServe("127.0.0.1:8081", mux); err != nil {
		log.Fatal(err)
	}
}
