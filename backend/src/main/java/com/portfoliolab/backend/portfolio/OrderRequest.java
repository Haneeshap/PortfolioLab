package com.portfoliolab.backend.portfolio;
import java.math.BigDecimal;
public record OrderRequest(Long assetId, String type, BigDecimal quantity,
                           String orderType, BigDecimal limitPrice, String timeInForce) {
 public OrderRequest(Long assetId,String type,BigDecimal quantity) { this(assetId,type,quantity,"MARKET",null,"GTC"); }
}
