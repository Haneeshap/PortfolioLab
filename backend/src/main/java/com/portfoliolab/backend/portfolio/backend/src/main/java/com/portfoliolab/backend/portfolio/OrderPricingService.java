package com.portfoliolab.backend.portfolio;

import com.portfoliolab.backend.asset.Asset;
import com.portfoliolab.backend.fx.FrankfurterRateService;
import com.portfoliolab.backend.market.MarketPrice;
import com.portfoliolab.backend.market.MarketService;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;

@Service
public class OrderPricingService {

    private final MarketService marketService;
    private final FrankfurterRateService frankfurterRateService;

    public OrderPricingService(
            MarketService marketService,
            FrankfurterRateService frankfurterRateService
    ) {
        this.marketService = marketService;
        this.frankfurterRateService = frankfurterRateService;
    }

    public Pricing calculate(
            Asset asset,
            Portfolio portfolio,
            BigDecimal quantity
    ) {
        MarketPrice quote;

        try {
            quote = marketService.getCurrentPrices()
                    .stream()
                    .filter(item -> asset.getSymbol().equals(item.symbol()))
                    .findFirst()
                    .orElse(null);
        } catch (Exception exception) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Simulated market service unavailable",
                    exception
            );
        }

        if (quote == null ||
                quote.price() == null ||
                quote.price().signum() <= 0 ||
                !asset.getCurrency().equals(quote.currency()) ||
                quote.updatedAt() == null ||
                quote.updatedAt().isBefore(Instant.now().minusSeconds(60)) ||
                quote.updatedAt().isAfter(Instant.now().plusSeconds(10))) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "A valid, recent simulated market quote is unavailable"
            );
        }

        BigDecimal price = quote.price()
                .setScale(4, RoundingMode.HALF_UP);

        BigDecimal assetTotal = price.multiply(quantity);

        if (assetTotal.precision() > 19 || assetTotal.scale() > 4) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Order total exceeds supported precision"
            );
        }

        BigDecimal fxRate;

        if (asset.getCurrency().equals(portfolio.getCurrency())) {
            fxRate = BigDecimal.ONE.setScale(8);
        } else {
            try {
                fxRate = frankfurterRateService.getLatestRate(
                        asset.getCurrency(),
                        portfolio.getCurrency()
                ).rate().setScale(8, RoundingMode.HALF_UP);
            } catch (Exception exception) {
                throw new ResponseStatusException(
                        HttpStatus.SERVICE_UNAVAILABLE,
                        "FX reference rate unavailable",
                        exception
                );
            }
        }

        if (fxRate.signum() <= 0) {
            throw new ResponseStatusException(
                    HttpStatus.SERVICE_UNAVAILABLE,
                    "Invalid FX reference rate"
            );
        }

        BigDecimal portfolioTotal = assetTotal.multiply(fxRate)
                .setScale(4, RoundingMode.HALF_UP);

        if (portfolioTotal.precision() > 19) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST,
                    "Converted order total exceeds supported precision"
            );
        }

        return new Pricing(price, assetTotal, fxRate, portfolioTotal);
    }

    public record Pricing(
            BigDecimal price,
            BigDecimal assetTotal,
            BigDecimal fxRate,
            BigDecimal portfolioTotal
    ) {}
}
