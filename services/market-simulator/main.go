package main

import (
	"encoding/json"
	"log"
	"net/http"
	"time"

	"github.com/coder/websocket"
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

	// WebSocket endpoint for live simulated prices.
	mux.HandleFunc("GET /ws/prices", func(w http.ResponseWriter, r *http.Request) {
		conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
			OriginPatterns: []string{"localhost:*", "127.0.0.1:*"},
		})
		if err != nil {
			log.Printf("WebSocket connection rejected: %v", err)
			return
		}
		defer conn.CloseNow()

		ctx := r.Context()

		sendPrices := func() error {
			prices := simulator.GetPrices()

			data, err := json.Marshal(prices)
			if err != nil {
				return err
			}

			return conn.Write(ctx, websocket.MessageText, data)
		}

		// Send prices immediately after connecting.
		if err := sendPrices(); err != nil {
			return
		}

		ticker := time.NewTicker(5 * time.Second)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if err := sendPrices(); err != nil {
					return
				}
			}
		}
	})

	// One shared market simulation for all connected clients.
	go func() {
		ticker := time.NewTicker(5 * time.Second)
		defer ticker.Stop()

		for range ticker.C {
			simulator.UpdatePrices()
		}
	}()

	log.Println("Market simulator listening on http://localhost:8081")
	log.Println("WebSocket endpoint: ws://localhost:8081/ws/prices")

	if err := http.ListenAndServe("127.0.0.1:8081", mux); err != nil {
		log.Fatal(err)
	}
}
