"use client";

import { useCallback, useEffect, useState } from "react";
import { useMarketPrices } from "@/components/MarketPriceProvider";

export type Portfolio = {
  id: number;
  name: string;
  cashBalance: number;
  currency: string;
};

export type Holding = {
  assetId: number;
  symbol: string;
  name: string;
  quantity: number;
  averageBuyPrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedProfitLoss: number;
  currency: string;
};

export type Transaction = {
  id: number;
  assetSymbol: string;
  type: string;
  quantity: number;
  pricePerUnit: number;
  totalAmount: number;
  currency: string;
  createdAt: string;
};

type PortfolioData = {
  portfolio: Portfolio;
  holdings: Holding[];
  transactions: Transaction[];
};

export function formatMoney(value: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function usePortfolioData() {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { prices, status } = useMarketPrices();

  const refresh = useCallback(async () => {
    const response = await fetch("/api/portfolio", {
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Unable to load portfolio data");
    }

    const result: PortfolioData = await response.json();
    setData(result);
    setError(null);
  }, []);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const response = await fetch("/api/portfolio", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Unable to load portfolio data");
        }

        const result: PortfolioData = await response.json();

        if (active) {
          setData(result);
          setError(null);
        }
      } catch (err) {
        if (active) {
          setError(
            err instanceof Error ? err.message : "Unknown error"
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, []);

  const livePriceBySymbol = new Map(
    prices.map((price) => [price.symbol, price])
  );

  const holdings = (data?.holdings ?? []).map((holding) => {
    const quote = livePriceBySymbol.get(holding.symbol);

    const priceIsLive =
      status === "connected" &&
      quote?.currency === holding.currency;

    const currentPrice = priceIsLive
      ? quote.price
      : holding.currentPrice;

    const marketValue = holding.quantity * currentPrice;
    const costBasis =
      holding.quantity * holding.averageBuyPrice;

    return {
      ...holding,
      currentPrice,
      marketValue,
      unrealizedProfitLoss: marketValue - costBasis,
      priceIsLive,
    };
  });

  const holdingsValue = holdings.reduce(
    (sum, holding) => sum + holding.marketValue,
    0
  );

  const investedAmount = holdings.reduce(
    (sum, holding) =>
      sum + holding.quantity * holding.averageBuyPrice,
    0
  );

  const unrealizedProfitLoss = holdingsValue - investedAmount;

  const totalValue =
    (data?.portfolio.cashBalance ?? 0) + holdingsValue;

  const isPortfolioLive =
    holdings.length > 0 &&
    holdings.every((holding) => holding.priceIsLive);

  return {
    portfolio: data?.portfolio ?? null,
    holdings,
    transactions: data?.transactions ?? [],
    loading,
    error,
    refresh,
    holdingsValue,
    investedAmount,
    unrealizedProfitLoss,
    totalValue,
    isPortfolioLive,
  };
}
