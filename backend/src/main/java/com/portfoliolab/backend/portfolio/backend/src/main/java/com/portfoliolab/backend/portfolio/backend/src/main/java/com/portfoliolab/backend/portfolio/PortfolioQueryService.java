
package com.portfoliolab.backend.portfolio;

import com.portfoliolab.backend.fx.FrankfurterRateService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

@Service
public class PortfolioQueryService {

    private final PortfolioRepository portfolioRepository;
    private final HoldingRepository holdingRepository;
    private final TransactionRepository transactionRepository;
    private final FrankfurterRateService frankfurterRateService;

    public PortfolioQueryService(
            PortfolioRepository portfolioRepository,
            HoldingRepository holdingRepository,
            TransactionRepository transactionRepository,
            FrankfurterRateService frankfurterRateService
    ) {
        this.portfolioRepository = portfolioRepository;
        this.holdingRepository = holdingRepository;
        this.transactionRepository = transactionRepository;
        this.frankfurterRateService = frankfurterRateService;
    }

    @Transactional(readOnly = true)
    public List<HoldingResponse> getHoldings(Long portfolioId) {
        Portfolio portfolio = portfolioRepository.findById(portfolioId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Portfolio not found"
                ));

        String portfolioCurrency = portfolio.getCurrency();

        return holdingRepository.findByPortfolioId(portfolioId)
                .stream()
                .map(holding -> {
                    var asset = holding.getAsset();

                    BigDecimal quantity = holding.getQuantity();
                    BigDecimal currentPrice = asset.getPrice();
                    BigDecimal averagePrice = holding.getAverageBuyPrice();

                    BigDecimal marketValue =
                            quantity.multiply(currentPrice);

                    BigDecimal costBasis =
                            quantity.multiply(averagePrice);

                    BigDecimal profitLoss =
                            marketValue.subtract(costBasis);

                    BigDecimal currentFxRate = BigDecimal.ONE;

                    if (!asset.getCurrency().equalsIgnoreCase(portfolioCurrency)) {
                        try {
                            currentFxRate = frankfurterRateService.getLatestRate(
                                    asset.getCurrency(),
                                    portfolioCurrency
                            ).rate();
                        } catch (Exception exception) {
                            throw new ResponseStatusException(
                                    HttpStatus.SERVICE_UNAVAILABLE,
                                    "FX reference rate unavailable for portfolio valuation",
                                    exception
                            );
                        }
                    }

                    if (currentFxRate == null || currentFxRate.signum() <= 0) {
                        throw new ResponseStatusException(
                                HttpStatus.SERVICE_UNAVAILABLE,
                                "Invalid FX reference rate"
                        );
                    }

                    BigDecimal convertedMarketValue =
                            marketValue.multiply(currentFxRate)
                                    .setScale(4, RoundingMode.HALF_UP);

                    BigDecimal historicalCost = holding
                            .getHistoricalCostPortfolio();

                    BigDecimal fxInclusiveProfitLoss =
                            convertedMarketValue.subtract(historicalCost);

                    return new HoldingResponse(
                            asset.getId(),
                            asset.getSymbol(),
                            asset.getName(),
                            quantity,
                            averagePrice,
                            currentPrice,
                            marketValue,
                            profitLoss,
                            asset.getCurrency(),
                            currentFxRate,
                            convertedMarketValue,
                            portfolioCurrency,
                            historicalCost,
                            fxInclusiveProfitLoss
                    );
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public List<TransactionResponse> getTransactions(Long portfolioId) {
        verifyPortfolioExists(portfolioId);

        return transactionRepository
                .findByPortfolioIdOrderByCreatedAtDesc(portfolioId)
                .stream()
                .map(transaction -> new TransactionResponse(
                        transaction.getId(),
                        transaction.getAsset().getSymbol(),
                        transaction.getTransactionType(),
                        transaction.getQuantity(),
                        transaction.getPricePerUnit(),
                        transaction.getTotalAmount(),
                        transaction.getCurrency(),
                        transaction.getCreatedAt()
                ))
                .toList();
    }

    private void verifyPortfolioExists(Long portfolioId) {
        if (!portfolioRepository.existsById(portfolioId)) {
            throw new ResponseStatusException(
                    HttpStatus.NOT_FOUND,
                    "Portfolio not found"
            );
        }
    }
}
