package main

import (
	"testing"
)

func TestSimulatorInitialPrices(t *testing.T) {
	simulator := NewMarketSimulator()

	prices := simulator.GetPrices()

	if len(prices) != 5 {
		t.Fatalf("expected 5 assets, got %d", len(prices))
	}

	for _, asset := range prices {
		if asset.Price <= 0 {
			t.Errorf("invalid price for %s: %f", asset.Symbol, asset.Price)
		}
	}
}

func TestSimulatorPriceUpdates(t *testing.T) {
	simulator := NewMarketSimulator()

	simulator.UpdatePrices()

	prices := simulator.GetPrices()

	for _, asset := range prices {
		if asset.Price <= 0 {
			t.Errorf("price became invalid for %s", asset.Symbol)
		}

		if asset.UpdatedAt.IsZero() {
			t.Errorf("missing update timestamp for %s", asset.Symbol)
		}
	}
}
