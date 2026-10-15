package main

import (
 "math/rand"
 "sync"
 "time"
)

type AssetPrice struct {
 Symbol string `json:"symbol"`
 Price float64 `json:"price"`
 Currency string `json:"currency"`
 UpdatedAt time.Time `json:"updatedAt"`
}

type MarketSimulator struct {
 mu sync.RWMutex
 prices map[string]AssetPrice
 volatility map[string]float64
}

func NewMarketSimulator() *MarketSimulator {
 now := time.Now().UTC()
 m := &MarketSimulator{prices: make(map[string]AssetPrice), volatility: make(map[string]float64)}
 m.prices["ALPHA"] = AssetPrice{"ALPHA", 98.4, "INR", now}
 m.volatility["ALPHA"] = 0.01
 m.prices["DEMO"] = AssetPrice{"DEMO", 125.5, "INR", now}
 m.volatility["DEMO"] = 0.01
 m.prices["GREEN"] = AssetPrice{"GREEN", 315.25, "INR", now}
 m.volatility["GREEN"] = 0.01
 m.prices["NOVA"] = AssetPrice{"NOVA", 842.75, "INR", now}
 m.volatility["NOVA"] = 0.01
 m.prices["ORBIT"] = AssetPrice{"ORBIT", 1560, "INR", now}
 m.volatility["ORBIT"] = 0.01
 m.prices["NEXUS"] = AssetPrice{"NEXUS", 1245, "INR", now}
 m.volatility["NEXUS"] = 0.013
 m.prices["QUANT"] = AssetPrice{"QUANT", 2180, "INR", now}
 m.volatility["QUANT"] = 0.018
 m.prices["CYBER"] = AssetPrice{"CYBER", 875, "INR", now}
 m.volatility["CYBER"] = 0.016
 m.prices["CLOUD"] = AssetPrice{"CLOUD", 1560, "INR", now}
 m.volatility["CLOUD"] = 0.014
 m.prices["FINIX"] = AssetPrice{"FINIX", 640, "INR", now}
 m.volatility["FINIX"] = 0.009
 m.prices["VAULT"] = AssetPrice{"VAULT", 1120, "INR", now}
 m.volatility["VAULT"] = 0.008
 m.prices["CREDO"] = AssetPrice{"CREDO", 425, "INR", now}
 m.volatility["CREDO"] = 0.013
 m.prices["PAYGO"] = AssetPrice{"PAYGO", 310, "INR", now}
 m.volatility["PAYGO"] = 0.017
 m.prices["TRUST"] = AssetPrice{"TRUST", 1780, "INR", now}
 m.volatility["TRUST"] = 0.008
 m.prices["SOLAR"] = AssetPrice{"SOLAR", 485, "INR", now}
 m.volatility["SOLAR"] = 0.017
 m.prices["VOLT"] = AssetPrice{"VOLT", 725, "INR", now}
 m.volatility["VOLT"] = 0.015
 m.prices["HYDRO"] = AssetPrice{"HYDRO", 365, "INR", now}
 m.volatility["HYDRO"] = 0.01
 m.prices["STEEL"] = AssetPrice{"STEEL", 920, "INR", now}
 m.volatility["STEEL"] = 0.011
 m.prices["METRO"] = AssetPrice{"METRO", 580, "INR", now}
 m.volatility["METRO"] = 0.009
 m.prices["MEDIX"] = AssetPrice{"MEDIX", 1340, "INR", now}
 m.volatility["MEDIX"] = 0.01
 m.prices["BIOVA"] = AssetPrice{"BIOVA", 765, "INR", now}
 m.volatility["BIOVA"] = 0.02
 m.prices["CAREX"] = AssetPrice{"CAREX", 545, "INR", now}
 m.volatility["CAREX"] = 0.012
 m.prices["FRESH"] = AssetPrice{"FRESH", 295, "INR", now}
 m.volatility["FRESH"] = 0.008
 m.prices["URBAN"] = AssetPrice{"URBAN", 690, "INR", now}
 m.volatility["URBAN"] = 0.011
 m.prices["AURORA"] = AssetPrice{"AURORA", 1095, "INR", now}
 m.volatility["AURORA"] = 0.009
 return m
}

func (m *MarketSimulator) GetPrices() []AssetPrice {
 m.mu.RLock()
 defer m.mu.RUnlock()
 result := make([]AssetPrice, 0, len(m.prices))
 for _, price := range m.prices { result = append(result, price) }
 return result
}

func (m *MarketSimulator) UpdatePrices() {
 m.mu.Lock()
 defer m.mu.Unlock()
 now := time.Now().UTC()
 for symbol, asset := range m.prices {
  change := (rand.Float64() - 0.5) * 2 * m.volatility[symbol]
  asset.Price = asset.Price * (1 + change)
  asset.UpdatedAt = now
  m.prices[symbol] = asset
 }
}
