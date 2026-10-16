"use client";

import { useCallback, useEffect, useState } from "react";
import { startOrderUpdates } from "@/lib/order-updates";
import { readOrders } from "@/lib/simulated-orders";
import { useMarketPrices } from "@/components/MarketPriceProvider";
import {
  valueHolding,
  summarizeHoldings,
} from "@/components/portfolioValuation";

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
  currentFxRate: number;
  marketValueInPortfolioCurrency: number;
  portfolioCurrency: string;
  historicalCostInPortfolioCurrency: number;
  unrealizedProfitLossInPortfolioCurrency: number;
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

export function usePortfolioData(liveOrders = false) {
  const [data, setData] = useState<PortfolioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { prices, status } = useMarketPrices();

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const response = await fetch("/api/portfolio", {
      signal, cache: "no-store",
    });

    if (!response.ok) {
      throw new Error("Unable to load portfolio data");
    }

    const result: PortfolioData = await response.json();
    if(signal?.aborted) return;
    setData(result);
    setError(null);
  }, []);

  useEffect(() => {
    if(!liveOrders) return;
    const controller=new AbortController();
    const stop=startOrderUpdates({initial:[],read:signal=>readOrders(signal,[],null),onSnapshot:()=>{},
      onPortfolioChange:()=>refresh(controller.signal),onError:message=>{if(message) setError(message);},
      onPaused:()=>setError("Live order updates are reconnecting. Refresh the portfolio to check its latest state.")});
    return ()=>{controller.abort();stop();};
  },[liveOrders,refresh]);

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

    const fxRate =
      holding.currency === data?.portfolio.currency
        ? 1
        : holding.currentFxRate;

    return {
      ...valueHolding(
        { ...holding, currentFxRate: fxRate },
        currentPrice
      ),
      priceIsLive,
    };
  });

  const {
    holdingsValue,
    investedAmount,
    unrealizedProfitLoss,
    totalValue,
  } = summarizeHoldings(
    holdings,
    data?.portfolio.cashBalance ?? 0
  );
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
