
package com.portfoliolab.backend.portfolio;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.List;

@Service
public class PortfolioQueryService {

    private final PortfolioRepository portfolioRepository;
    private final HoldingRepository holdingRepository;
    private final TransactionRepository transactionRepository;

    public PortfolioQueryService(
            PortfolioRepository portfolioRepository,
            HoldingRepository holdingRepository,
            TransactionRepository transactionRepository
    ) {
        this.portfolioRepository = portfolioRepository;
        this.holdingRepository = holdingRepository;
        this.transactionRepository = transactionRepository;
    }

    @Transactional(readOnly = true)
    public List<HoldingResponse> getHoldings(Long portfolioId) {
        verifyPortfolioExists(portfolioId);

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

                    return new HoldingResponse(
                            asset.getId(),
                            asset.getSymbol(),
                            asset.getName(),
                            quantity,
                            averagePrice,
                            currentPrice,
                            marketValue,
                            profitLoss,
                            asset.getCurrency()
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
