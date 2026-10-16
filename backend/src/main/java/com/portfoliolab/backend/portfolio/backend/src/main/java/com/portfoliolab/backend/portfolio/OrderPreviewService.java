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

    @org.springframework.beans.factory.annotation.Autowired private com.portfoliolab.backend.oms.OrderReservations reservations;
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

        com.portfoliolab.backend.oms.OrderConditions.validate(request.orderType()==null?"MARKET":request.orderType(),request.limitPrice(),request.timeInForce()==null?"GTC":request.timeInForce());
        OrderPricingService.Pricing pricing =
                pricingService.calculate(asset, portfolio, quantity);

        if(request.limitPrice()!=null) {
            BigDecimal total=request.limitPrice().multiply(quantity).setScale(4,java.math.RoundingMode.HALF_UP);
            pricing=new OrderPricingService.Pricing(request.limitPrice(),total,pricing.fxRate(),total.multiply(pricing.fxRate()).setScale(4,java.math.RoundingMode.HALF_UP));
        }

        BigDecimal available=portfolio.getCashBalance().subtract(reservations==null?BigDecimal.ZERO:reservations.cash(portfolioId,-1));
        BigDecimal charges = BigDecimal.ZERO.setScale(4);

        Boolean sufficientCash = side.equals("BUY")
                ? available
                    .compareTo(com.portfoliolab.backend.oms.OrderReservations.reservationUnit(request,pricing).multiply(quantity)) >= 0
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
                available,
                charges,
                sufficientCash,
                "Educational simulation. Buying power includes a 5% reservation buffer using the limit price or current quote and reference FX. Prices and FX may change; no funds reserved by preview."
        );
    }
}