export type ValuationHolding = {
  quantity: number;
  averageBuyPrice: number;
  currentPrice: number;
  currentFxRate: number;
  historicalCostInPortfolioCurrency: number;
};

export function valueHolding<T extends ValuationHolding>(
  holding: T,
  currentPrice: number
) {
  const fxRate = holding.currentFxRate;
  const historicalCost =
    holding.historicalCostInPortfolioCurrency;

  if (!Number.isFinite(fxRate) || fxRate <= 0) {
    throw new Error("Invalid FX rate for portfolio valuation");
  }

  if (!Number.isFinite(currentPrice) || currentPrice < 0) {
    throw new Error("Invalid market price for portfolio valuation");
  }

  if (
    !Number.isFinite(historicalCost) ||
    historicalCost < 0
  ) {
    throw new Error("Invalid historical cost for portfolio valuation");
  }

  const marketValue = holding.quantity * currentPrice;

  const assetCurrencyCostBasis =
    holding.quantity * holding.averageBuyPrice;

  const marketValueInPortfolioCurrency =
    marketValue * fxRate;

  const unrealizedProfitLossInPortfolioCurrency =
    marketValueInPortfolioCurrency - historicalCost;

  return {
    ...holding,
    currentPrice,
    marketValue,

    // Price-only P&L in the asset's own currency.
    unrealizedProfitLoss:
      marketValue - assetCurrencyCostBasis,

    marketValueInPortfolioCurrency,

    // Historical cost remains fixed at executed trade FX.
    historicalCostInPortfolioCurrency: historicalCost,

    // Includes both market-price and FX movements.
    unrealizedProfitLossInPortfolioCurrency,

    // Retained for price-only attribution at current FX.
    costBasisAtCurrentFx:
      assetCurrencyCostBasis * fxRate,

    unrealizedProfitLossAtCurrentFx:
      (marketValue - assetCurrencyCostBasis) * fxRate,
  };
}

export function summarizeHoldings<
  T extends {
    marketValueInPortfolioCurrency: number;
    historicalCostInPortfolioCurrency: number;
  }
>(
  holdings: T[],
  cashBalance: number
) {
  const holdingsValue = holdings.reduce(
    (sum, holding) =>
      sum + holding.marketValueInPortfolioCurrency,
    0
  );

  const investedAmount = holdings.reduce(
    (sum, holding) =>
      sum + holding.historicalCostInPortfolioCurrency,
    0
  );

  return {
    holdingsValue,
    investedAmount,
    unrealizedProfitLoss:
      holdingsValue - investedAmount,
    totalValue: cashBalance + holdingsValue,
  };
}