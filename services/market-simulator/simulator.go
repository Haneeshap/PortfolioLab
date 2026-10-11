package main

import (
	"math/rand"
	"sync"
	"time"
)

type AssetPrice struct {
	Symbol    string    `json:"symbol"`
	Price     float64   `json:"price"`
	Currency  string    `json:"currency"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type MarketSimulator struct {
	mu     sync.RWMutex
	prices map[string]AssetPrice
}

func NewMarketSimulator() *MarketSimulator {
	now := time.Now().UTC()

	return &MarketSimulator{
		prices: map[string]AssetPrice{
			"ALPHA": {"ALPHA", 98.40, "INR", now},
			"DEMO":  {"DEMO", 125.50, "INR", now},
			"GREEN": {"GREEN", 315.25, "INR", now},
			"NOVA":  {"NOVA", 842.75, "INR", now},
			"ORBIT": {"ORBIT", 1560.00, "INR", now},
		},
	}
}

func (m *MarketSimulator) GetPrices() []AssetPrice {
	m.mu.RLock()
	defer m.mu.RUnlock()

	result := make([]AssetPrice, 0, len(m.prices))

	for _, price := range m.prices {
		result = append(result, price)
	}

	return result
}

func (m *MarketSimulator) UpdatePrices() {
	m.mu.Lock()
	defer m.mu.Unlock()

	for symbol, asset := range m.prices {
		change := (rand.Float64() - 0.5) * 0.02

		asset.Price = asset.Price * (1 + change)
		asset.UpdatedAt = time.Now().UTC()

		m.prices[symbol] = asset
	}
}
