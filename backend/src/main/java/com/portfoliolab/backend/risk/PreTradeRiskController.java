package com.portfoliolab.backend.risk;

import com.portfoliolab.backend.asset.Asset;
import com.portfoliolab.backend.asset.AssetRepository;
import com.portfoliolab.backend.portfolio.*;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.math.BigDecimal;
import java.util.Locale;

@RestController
@RequestMapping("/api/portfolios/{portfolioId}/pre-trade-risk")
public class PreTradeRiskController {
    private final PortfolioRepository portfolios;
    private final AssetRepository assets;
    private final OrderPricingService pricing;
    private final PreTradeRiskService risk;
    public PreTradeRiskController(PortfolioRepository portfolios, AssetRepository assets,
                                  OrderPricingService pricing, PreTradeRiskService risk) {
        this.portfolios=portfolios; this.assets=assets; this.pricing=pricing; this.risk=risk;
    }
    /** Advisory preview only: final enforcement always happens in OrderService under a write lock. */
    @PostMapping("/evaluate")
    @Transactional(readOnly=true)
    public PreTradeRiskService.Decision evaluate(@PathVariable Long portfolioId, @RequestBody OrderRequest request) {
        if (request == null || request.assetId()==null || request.type()==null || request.quantity()==null)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "assetId, type and quantity required");
        String side=request.type().trim().toUpperCase(Locale.ROOT);
        BigDecimal quantity=request.quantity();
        if ((!side.equals("BUY") && !side.equals("SELL")) || quantity.signum()<=0 ||
            quantity.stripTrailingZeros().scale()>0 || quantity.precision()>13)
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid order type or quantity");
        Portfolio portfolio=portfolios.findById(portfolioId)
            .orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Portfolio not found"));
        Asset asset=assets.findById(request.assetId())
            .orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Asset not found"));
        OrderPricingService.Pricing quote=pricing.calculate(asset,portfolio,quantity);
        com.portfoliolab.backend.oms.OrderConditions.validate(request.orderType()==null?"MARKET":request.orderType(),request.limitPrice(),request.timeInForce()==null?"GTC":request.timeInForce());
        return risk.evaluate(portfolio,asset,side,quantity,request.limitPrice()==null?quote.portfolioTotal():request.limitPrice().multiply(quote.fxRate()).multiply(quantity));
    }
}
