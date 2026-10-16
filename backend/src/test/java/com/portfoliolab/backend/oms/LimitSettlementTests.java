package com.portfoliolab.backend.oms;
import com.portfoliolab.backend.portfolio.*;
import com.portfoliolab.backend.asset.*;
import com.portfoliolab.backend.notification.NotificationOutbox;
import com.portfoliolab.backend.risk.PreTradeRiskService;
import org.springframework.context.ApplicationEventPublisher;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import java.util.Optional;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;
class LimitSettlementTests {
 @Test void ineligibleBuyAndSellNeverTouchCashHoldingsOrTransaction() {
  for(String side:new String[]{"BUY","SELL"}) {
   var portfolios=mock(PortfolioRepository.class);var assets=mock(AssetRepository.class);
   var holdings=mock(HoldingRepository.class);var trades=mock(TransactionRepository.class);
   var pricing=mock(OrderPricingService.class);var risk=mock(PreTradeRiskService.class);
   var portfolio=mock(Portfolio.class);var asset=mock(Asset.class);
   when(portfolios.findByIdForUpdate(1L)).thenReturn(Optional.of(portfolio));
   when(assets.findById(2L)).thenReturn(Optional.of(asset));
   var price=new BigDecimal(side.equals("BUY")?"101":"99");
   when(pricing.calculate(asset,portfolio,BigDecimal.ONE)).thenReturn(new OrderPricingService.Pricing(price,price,BigDecimal.ONE,price));
   var service=new OrderService(portfolios,assets,holdings,trades,pricing,risk,mock(NotificationOutbox.class),mock(ApplicationEventPublisher.class));
   assertThrows(OrderConditions.PriceNotEligible.class,()->service.placeOrder(1L,new OrderRequest(2L,side,BigDecimal.ONE,"LIMIT",new BigDecimal("100"),"GTC")));
   verify(portfolio,never()).setCashBalance(any());verifyNoInteractions(holdings,trades,risk);
   verify(pricing,times(1)).calculate(asset,portfolio,BigDecimal.ONE);
  }
 }
}
