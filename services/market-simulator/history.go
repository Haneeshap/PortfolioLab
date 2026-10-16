package main

import (
	"encoding/json"
	"fmt"
	"hash/fnv"
	"math"
	"math/rand"
	"net/http"
	"time"
)

// history-v1 is generated fixture history, independent of the mutable live simulator.
type Candle struct {
	Time   string  `json:"time"`
	Open   float64 `json:"open"`
	High   float64 `json:"high"`
	Low    float64 `json:"low"`
	Close  float64 `json:"close"`
	Volume int64   `json:"volume"`
}

func roundPrice(v float64) float64 { return math.Round(v*10000) / 10000 }
func GenerateHistory(symbol string, from, to time.Time) ([]Candle, error) {
	anchor := time.Date(2025, 1, 1, 0, 0, 0, 0, time.UTC)
	seed, ok := NewMarketSimulator().prices[symbol]
	if !ok {
		return nil, fmt.Errorf("unknown fictional symbol")
	}
	if from.Before(anchor) || !to.After(from) || to.Sub(from) > 366*24*time.Hour || to.After(time.Now().UTC().Truncate(24*time.Hour)) {
		return nil, fmt.Errorf("use completed UTC days since 2025-01-01, maximum 366 days")
	}
	hash := fnv.New64a()
	_, _ = hash.Write([]byte(symbol))
	rng := rand.New(rand.NewSource(int64(hash.Sum64())))
	result := make([]Candle, 0)
	close := seed.Price
	for day, i := anchor, 0; day.Before(to); day, i = day.AddDate(0, 0, 1), i+1 {
		open := roundPrice(close)
		change := 0.0003 + 0.008*math.Sin(float64(i)*0.7) + (rng.Float64()-0.5)*0.025
		close = roundPrice(math.Max(0.01, open*(1+change)))
		high := roundPrice(math.Max(open, close) * (1 + rng.Float64()*0.008))
		low := roundPrice(math.Max(0.0001, math.Min(open, close)*(1-rng.Float64()*0.008)))
		volume := int64(10000 + rng.Intn(90000))
		if !day.Before(from) {
			result = append(result, Candle{day.Format(time.RFC3339), open, high, low, close, volume})
		}
	}
	return result, nil
}
func historyHandler(w http.ResponseWriter, r *http.Request) {
	from, e1 := time.Parse("2006-01-02", r.URL.Query().Get("from"))
	to, e2 := time.Parse("2006-01-02", r.URL.Query().Get("to"))
	if e1 != nil || e2 != nil {
		http.Error(w, "from/to must be UTC dates; to is exclusive", 400)
		return
	}
	candles, err := GenerateHistory(r.URL.Query().Get("symbol"), from, to)
	if err != nil {
		http.Error(w, err.Error(), 400)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{"symbol": r.URL.Query().Get("symbol"), "source": "fictional-history-v1", "interval": "1d", "candles": candles})
}
