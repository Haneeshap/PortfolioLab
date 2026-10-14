package com.portfoliolab.backend.portfolio;

import com.portfoliolab.backend.asset.Asset;
import com.portfoliolab.backend.asset.AssetRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.Locale;

@Service
public class OrderPreviewService {

    private final PortfolioRepository portfolioRepository;
    private final AssetRepository assetRepository;
    private final OrderPricingService pricingService;

    public OrderPreviewService(
            PortfolioRepository portfolioRepository,
            AssetRepository assetRepository,
            OrderPricingService pricingService
    ) {
        this.portfolioRepository = portfolioRepository;
        this.assetRepository = assetRepository;
        this.pricingService = pricingService;
    }

    @Transactional(readOnly = true)
    public OrderPreviewResponse preview(
            Long portfolioId,
            OrderRequest request
    ) {
        if (request == null ||
                request.assetId() == null ||
                request.type() == null ||
                request.quantity() == null) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Asset ID, order type, and quantity are required"
            );
        }

        String side = request.type()
                .trim()
                .toUpperCase(Locale.ROOT);

        BigDecimal quantity = request.quantity();

        if (!side.equals("BUY") && !side.equals("SELL")) {
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

        Portfolio portfolio = portfolioRepository
                .findById(portfolioId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Portfolio not found"
                ));

        Asset asset = assetRepository
                .findById(request.assetId())
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND,
                        "Asset not found"
                ));

        OrderPricingService.Pricing pricing =
                pricingService.calculate(asset, portfolio, quantity);

        BigDecimal charges = BigDecimal.ZERO.setScale(4);

        Boolean sufficientCash = side.equals("BUY")
                ? portfolio.getCashBalance()
                    .compareTo(pricing.portfolioTotal()) >= 0
                : null;

        return new OrderPreviewResponse(
                asset.getSymbol(),
                side,
                quantity,
                pricing.price(),
                asset.getCurrency(),
                pricing.assetTotal(),
                pricing.fxRate(),
                pricing.portfolioTotal(),
                portfolio.getCurrency(),
                portfolio.getCashBalance(),
                charges,
                sufficientCash,
                "Educational simulation. Prices and FX rates may change before execution. No order has been placed."
        );
    }
}