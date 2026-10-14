package com.portfoliolab.backend.portfolio;

import com.portfoliolab.backend.asset.Asset;
import com.portfoliolab.backend.asset.AssetRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.Locale;
@Service
public class OrderService {

    private final PortfolioRepository portfolioRepository;
    private final AssetRepository assetRepository;
    private final HoldingRepository holdingRepository;
    private final TransactionRepository transactionRepository;
    private final OrderPricingService pricingService;

    public OrderService(
            PortfolioRepository portfolioRepository,
            AssetRepository assetRepository,
            HoldingRepository holdingRepository,
            TransactionRepository transactionRepository,
            OrderPricingService pricingService
    ) {
        this.portfolioRepository = portfolioRepository;
        this.assetRepository = assetRepository;
        this.holdingRepository = holdingRepository;
        this.transactionRepository = transactionRepository;
        this.pricingService = pricingService;
    }

    @Transactional
    public OrderResponse placeOrder(Long portfolioId, OrderRequest request) {

        if (request == null ||
                request.assetId() == null ||
                request.type() == null ||
                request.quantity() == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Asset ID, order type, and quantity are required"
            );
        }

        String type = request.type().trim().toUpperCase(Locale.ROOT);
        BigDecimal quantity = request.quantity();

        if (!type.equals("BUY") && !type.equals("SELL")) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Order type must be BUY or SELL"
            );
        }

        if (quantity.signum() <= 0 ||
                quantity.stripTrailingZeros().scale() > 0 ||
                quantity.precision() > 13) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Quantity must be a positive whole number of at most 13 digits"
            );
        }

        Portfolio portfolio = portfolioRepository.findByIdForUpdate(portfolioId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Portfolio not found"
                ));

        Asset asset = assetRepository.findById(request.assetId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Asset not found"
                ));



        OrderPricingService.Pricing pricing =
                pricingService.calculate(asset, portfolio, quantity);

        BigDecimal price = pricing.price();
        BigDecimal total = pricing.assetTotal();
        BigDecimal executionFxRate = pricing.fxRate();
        BigDecimal portfolioAmount = pricing.portfolioTotal();

        Holding holding = holdingRepository
                .findByPortfolioIdAndAssetId(portfolioId, asset.getId())
                .orElse(null);

        if (type.equals("BUY")) {
            processBuy(portfolio, asset, holding, quantity, price, portfolioAmount);
        } else {
            processSell(portfolio, holding, quantity, portfolioAmount);
        }

        Transaction transaction = new Transaction(
                portfolio,
                asset,
                type,
                quantity,
                price,
                total,
                asset.getCurrency(),
                executionFxRate,
                portfolioAmount
        );

        transactionRepository.save(transaction);

        return new OrderResponse(
                transaction.getId(),
                portfolio.getId(),
                asset.getSymbol(),
                type,
                quantity,
                price,
                total,
                asset.getCurrency(),
                executionFxRate,
                portfolioAmount,
                portfolio.getCurrency(),
                portfolio.getCashBalance()
        );
    }

    private void processBuy(
            Portfolio portfolio,
            Asset asset,
            Holding holding,
            BigDecimal quantity,
            BigDecimal price,
            BigDecimal total
    ) {
        if (portfolio.getCashBalance().compareTo(total) < 0) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Insufficient virtual cash"
            );
        }

        if (holding == null) {
            Holding created = new Holding(
                    portfolio, asset, quantity, price
            );
            created.setHistoricalCostPortfolio(total);
            holdingRepository.save(created);
        } else {
            BigDecimal oldQuantity = holding.getQuantity();
            BigDecimal newQuantity = oldQuantity.add(quantity);

            BigDecimal oldCost = oldQuantity.multiply(
                    holding.getAverageBuyPrice()
            );

            BigDecimal newCost = quantity.multiply(price);

            BigDecimal newAverage = oldCost.add(newCost)
                    .divide(newQuantity, 4, RoundingMode.HALF_UP);

            BigDecimal updatedHistoricalCost = holding
                    .getHistoricalCostPortfolio()
                    .add(total);

            holding.updatePosition(newQuantity, newAverage);
            holding.setHistoricalCostPortfolio(updatedHistoricalCost);
        }

        portfolio.setCashBalance(
                portfolio.getCashBalance().subtract(total)
        );
    }

    private void processSell(
            Portfolio portfolio,
            Holding holding,
            BigDecimal quantity,
            BigDecimal total
    ) {
        if (holding == null ||
                holding.getQuantity().compareTo(quantity) < 0) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Insufficient holdings"
            );
        }

        BigDecimal originalQuantity = holding.getQuantity();
        BigDecimal remaining = originalQuantity.subtract(quantity);

        if (remaining.signum() == 0) {
            holdingRepository.delete(holding);
        } else {
            BigDecimal remainingHistoricalCost = holding
                    .getHistoricalCostPortfolio()
                    .multiply(remaining)
                    .divide(originalQuantity, 4, RoundingMode.HALF_UP);

            holding.updatePosition(
                    remaining,
                    holding.getAverageBuyPrice()
            );

            holding.setHistoricalCostPortfolio(
                    remainingHistoricalCost
            );
        }

        portfolio.setCashBalance(
                portfolio.getCashBalance().add(total)
        );
    }
}
